import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { createHash } from "node:crypto";
import { DatabaseService } from "../database/database.service.js";
import { Prisma } from "../generated/prisma/client.js";
import type {
  DispensePharmacyDto,
  PharmacyListDto,
  ReceivePharmacyStockDto,
} from "./pharmacy.dto.js";
import {
  assertCapacity,
  assertLotMatches,
  calendarDate,
  hospitalDate,
  quantity,
  unit,
} from "./pharmacy.rules.js";
const hash = (body: unknown) =>
  createHash("sha256").update(JSON.stringify(body)).digest("hex");
const stockFields = {
  id: true,
  medicineId: true,
  batchNumber: true,
  expiryDate: true,
  receivedQuantity: true,
  quantityUnit: true,
  supplierName: true,
  reference: true,
  medicineName: true,
  strength: true,
  dosageForm: true,
  receivedAt: true,
  medicine: {
    select: {
      code: true,
      displayName: true,
      strength: true,
      dosageForm: true,
      isActive: true,
    },
  },
  receivedBy: { select: { fullName: true } },
} satisfies Prisma.PharmacyStockLotSelect;
const receiptFields = {
  id: true,
  prescriptionId: true,
  patientName: true,
  patientMrn: true,
  notes: true,
  dispensedAt: true,
  dispensedBy: { select: { fullName: true } },
  items: {
    orderBy: { id: "asc" },
    select: {
      id: true,
      prescriptionItemId: true,
      stockLotId: true,
      quantity: true,
      quantityUnit: true,
      medicineName: true,
      strength: true,
      dosageForm: true,
      batchNumber: true,
      expiryDate: true,
    },
  },
} satisfies Prisma.PharmacyDispenseSelect;
@Injectable()
export class PharmacyService {
  constructor(private readonly database: DatabaseService) {}
  private async lock(tx: Prisma.TransactionClient) {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(784211)::text AS "lockResult"`;
  }
  async receive(actorId: string, key: string, dto: ReceivePharmacyStockDto) {
    const expiryDate = calendarDate(dto.expiryDate),
      amount = quantity(dto.receivedQuantity);
    const normalized = {
      medicineId: dto.medicineId.toLowerCase(),
      batchNumber: dto.batchNumber.trim().toUpperCase(),
      expiryDate: dto.expiryDate,
      receivedQuantity: amount.toFixed(2),
      quantityUnit: unit(dto.quantityUnit),
      supplierName: dto.supplierName?.trim() || null,
      reference: dto.reference?.trim() || null,
    };
    const requestHash = hash(normalized),
      idempotencyKey = key.toLowerCase();
    return this.database.$transaction(
      async (tx) => {
        await this.lock(tx);
        const previous = await tx.pharmacyStockLot.findUnique({
          where: {
            receivedByStaffId_idempotencyKey: {
              receivedByStaffId: actorId,
              idempotencyKey,
            },
          },
          select: { ...stockFields, requestHash: true },
        });
        if (previous) {
          if (previous.requestHash !== requestHash)
            throw new ConflictException(
              "This request key belongs to a different receipt.",
            );
          const { requestHash: _hash, ...stock } = previous;
          return { replayed: true, stock };
        }
        if (!normalized.batchNumber || !normalized.quantityUnit)
          throw new BadRequestException("Batch and unit are required.");
        if (dto.expiryDate <= hospitalDate())
          throw new BadRequestException(
            "Expiry date must be after the current hospital date.",
          );
        await tx.$queryRaw`SELECT id FROM "Medicine" WHERE id = ${normalized.medicineId}::uuid FOR SHARE`;
        const medicine = await tx.medicine.findUnique({
          where: { id: normalized.medicineId },
          select: {
            id: true,
            isActive: true,
            displayName: true,
            strength: true,
            dosageForm: true,
          },
        });
        if (!medicine) throw new NotFoundException("Medicine not found.");
        if (!medicine.isActive)
          throw new ConflictException("Cannot receive an inactive medicine.");
        const stock = await tx.pharmacyStockLot.create({
          data: {
            ...normalized,
            expiryDate,
            medicineName: medicine.displayName,
            strength: medicine.strength,
            dosageForm: medicine.dosageForm,
            receivedByStaffId: actorId,
            idempotencyKey,
            requestHash,
          },
          select: stockFields,
        });
        await tx.auditEvent.create({
          data: {
            actorStaffId: actorId,
            action: "PHARMACY_STOCK_RECEIVED",
            resourceType: "PharmacyStockLot",
            resourceId: stock.id,
          },
        });
        return { replayed: false, stock };
      },
      { isolationLevel: "ReadCommitted", maxWait: 5000, timeout: 15000 },
    );
  }
  async stock(query: PharmacyListDto) {
    const search = query.search?.trim().replace(/[\\%_]/g, "\\$&");
    const where: Prisma.PharmacyStockLotWhereInput = {
      ...(query.medicineId ? { medicineId: query.medicineId } : {}),
      ...(search
        ? {
            OR: [
              { batchNumber: { contains: search, mode: "insensitive" } },
              {
                medicine: {
                  displayName: { contains: search, mode: "insensitive" },
                },
              },
            ],
          }
        : {}),
    };
    return this.database.$transaction(
      async (tx) => {
        const lots = await tx.pharmacyStockLot.findMany({
          where,
          select: stockFields,
          orderBy: [{ expiryDate: "asc" }, { id: "asc" }],
          skip: (query.page - 1) * query.limit,
          take: query.limit,
        });
        const used = await tx.pharmacyDispenseItem.groupBy({
          by: ["stockLotId"],
          where: { stockLotId: { in: lots.map((x) => x.id) } },
          _sum: { quantity: true },
        });
        const sums = new Map(
          used.map((x) => [
            x.stockLotId,
            x._sum.quantity ?? new Prisma.Decimal(0),
          ]),
        );
        const today = hospitalDate();
        const items = lots.map((x) => ({
          ...x,
          dispensedQuantity: (sums.get(x.id) ?? new Prisma.Decimal(0)).toFixed(
            2,
          ),
          availableQuantity: x.receivedQuantity
            .minus(sums.get(x.id) ?? 0)
            .toFixed(2),
          expired: x.expiryDate.toISOString().slice(0, 10) <= today,
          verifiedSnapshot: !!(x.medicineName && x.strength && x.dosageForm),
        }));
        const total = await tx.pharmacyStockLot.count({ where });
        return {
          items,
          pagination: {
            page: query.page,
            limit: query.limit,
            total,
            totalPages: Math.ceil(total / query.limit),
          },
          timeZone: "Asia/Kolkata",
        };
      },
      { isolationLevel: "RepeatableRead" },
    );
  }
  async queue(query: PharmacyListDto) {
    const literal = query.search?.trim().replace(/[\\%_]/g, "\\$&");
    const pattern = `%${literal ?? ""}%`;
    const filter = Prisma.sql`p."status" = 'ISSUED' AND (${literal || null}::text IS NULL OR p."patientName" ILIKE ${pattern} OR p."patientMrn" ILIKE ${pattern}) AND (${query.scope} = 'all' OR EXISTS (SELECT 1 FROM "PrescriptionItem" i WHERE i."prescriptionId"=p.id AND i.quantity > COALESCE((SELECT SUM(d.quantity) FROM "PharmacyDispenseItem" d WHERE d."prescriptionItemId"=i.id),0)))`;
    return this.database.$transaction(
      async (tx) => {
        const ids = await tx.$queryRaw<{ id: string }[]>(
          Prisma.sql`SELECT p.id FROM "Prescription" p WHERE ${filter} ORDER BY p."issuedAt" ASC,p.id ASC OFFSET ${(query.page - 1) * query.limit} LIMIT ${query.limit}`,
        );
        const [count] = await tx.$queryRaw<{ total: number }[]>(
          Prisma.sql`SELECT COUNT(*)::int AS total FROM "Prescription" p WHERE ${filter}`,
        );
        const records = await tx.prescription.findMany({
          where: { id: { in: ids.map((x) => x.id) } },
          select: {
            id: true,
            version: true,
            patientName: true,
            patientMrn: true,
            prescriberName: true,
            issuedAt: true,
            items: { select: { id: true, quantity: true } },
          },
        });
        const sums = await tx.pharmacyDispenseItem.groupBy({
          by: ["prescriptionItemId"],
          where: {
            prescriptionItem: { prescriptionId: { in: ids.map((x) => x.id) } },
          },
          _sum: { quantity: true },
        });
        const totals = new Map(
          sums.map((x) => [
            x.prescriptionItemId,
            x._sum.quantity ?? new Prisma.Decimal(0),
          ]),
        );
        const items = ids.map(({ id }) => {
          const p = records.find((x) => x.id === id)!;
          const complete = p.items.filter((i) =>
            (totals.get(i.id) ?? new Prisma.Decimal(0)).gte(i.quantity),
          ).length;
          return {
            ...p,
            lineCount: p.items.length,
            completedLines: complete,
            dispensingStatus:
              complete === p.items.length
                ? "FULLY_DISPENSED"
                : p.items.some((i) =>
                      (totals.get(i.id) ?? new Prisma.Decimal(0)).gt(0),
                    )
                  ? "PARTIALLY_DISPENSED"
                  : "NOT_DISPENSED",
            items: undefined,
          };
        });
        return {
          items,
          pagination: {
            page: query.page,
            limit: query.limit,
            total: count.total,
            totalPages: Math.ceil(count.total / query.limit),
          },
        };
      },
      { isolationLevel: "RepeatableRead", timeout: 15000 },
    );
  }
  async detail(id: string) {
    return this.database.$transaction(
      async (tx) => {
        const prescription = await tx.prescription.findFirst({
          where: { id, status: { in: ["ISSUED", "REPLACED", "CANCELLED"] } },
          select: {
            id: true,
            status: true,
            version: true,
            patientName: true,
            patientMrn: true,
            prescriberName: true,
            prescriberRegistrationNumber: true,
            prescriberRegistrationAuthority: true,
            issuedAt: true,
            allergyStatus: true,
            allergyDetails: true,
            instructions: true,
            items: {
              orderBy: { position: "asc" },
              select: {
                id: true,
                medicineId: true,
                medicineName: true,
                genericName: true,
                strength: true,
                dosageForm: true,
                dose: true,
                route: true,
                frequency: true,
                duration: true,
                quantity: true,
                quantityUnit: true,
                instructions: true,
              },
            },
          },
        });
        if (!prescription?.issuedAt)
          throw new NotFoundException("Issued prescription not found.");
        const sums = await tx.pharmacyDispenseItem.groupBy({
          by: ["prescriptionItemId"],
          where: { prescriptionItem: { prescriptionId: id } },
          _sum: { quantity: true },
        });
        const used = new Map(
          sums.map((x) => [
            x.prescriptionItemId,
            x._sum.quantity ?? new Prisma.Decimal(0),
          ]),
        );
        const items = prescription.items.map((x) => ({
          ...x,
          dispensedQuantity: (used.get(x.id) ?? new Prisma.Decimal(0)).toFixed(
            2,
          ),
          remainingQuantity: Prisma.Decimal.max(
            0,
            x.quantity.minus(used.get(x.id) ?? 0),
          ).toFixed(2),
        }));
        const history = await tx.pharmacyDispense.findMany({
          where: { prescriptionId: id },
          select: receiptFields,
          orderBy: [{ dispensedAt: "desc" }, { id: "desc" }],
          take: 100,
        });
        return {
          prescription: { ...prescription, items },
          history,
          historyLimitedTo: 100,
          timeZone: "Asia/Kolkata",
        };
      },
      { isolationLevel: "RepeatableRead", timeout: 15000 },
    );
  }
  async history(query: PharmacyListDto) {
    const search = query.search?.trim().replace(/[\\%_]/g, "\\$&");
    const where: Prisma.PharmacyDispenseWhereInput = search
      ? {
          OR: [
            { patientName: { contains: search, mode: "insensitive" } },
            { patientMrn: { contains: search, mode: "insensitive" } },
          ],
        }
      : {};
    const [items, total] = await this.database.$transaction(
      [
        this.database.pharmacyDispense.findMany({
          where,
          select: receiptFields,
          orderBy: [{ dispensedAt: "desc" }, { id: "desc" }],
          skip: (query.page - 1) * query.limit,
          take: query.limit,
        }),
        this.database.pharmacyDispense.count({ where }),
      ],
      { isolationLevel: "RepeatableRead" },
    );
    return {
      items,
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }
  async dispense(
    id: string,
    actorId: string,
    key: string,
    dto: DispensePharmacyDto,
  ) {
    if (dto.patientAndPrescriptionConfirmed !== true)
      throw new BadRequestException(
        "Confirm patient identity and prescription review.",
      );
    const allocations = dto.allocations
      .map((x) => ({
        prescriptionItemId: x.prescriptionItemId.toLowerCase(),
        stockLotId: x.stockLotId.toLowerCase(),
        quantity: quantity(x.quantity).toFixed(2),
      }))
      .sort(
        (a, b) =>
          a.prescriptionItemId.localeCompare(b.prescriptionItemId) ||
          a.stockLotId.localeCompare(b.stockLotId),
      );
    if (!allocations.length || allocations.length > 100)
      throw new BadRequestException("Choose 1–100 allocations.");
    if (
      new Set(allocations.map((x) => `${x.prescriptionItemId}:${x.stockLotId}`))
        .size !== allocations.length
    )
      throw new BadRequestException(
        "Combine duplicate item and stock lot allocations.",
      );
    const requestHash = hash({
      prescriptionId: id.toLowerCase(),
      expectedPrescriptionVersion: dto.expectedPrescriptionVersion,
      patientAndPrescriptionConfirmed: true,
      notes: dto.notes?.trim() || null,
      allocations,
    });
    const idempotencyKey = key.toLowerCase();
    return this.database.$transaction(
      async (tx) => {
        await this.lock(tx);
        const previous = await tx.pharmacyDispense.findUnique({
          where: {
            dispensedByStaffId_idempotencyKey: {
              dispensedByStaffId: actorId,
              idempotencyKey,
            },
          },
          select: { ...receiptFields, requestHash: true },
        });
        if (previous) {
          if (previous.requestHash !== requestHash)
            throw new ConflictException(
              "This request key belongs to different dispensing.",
            );
          const { requestHash: _hash, ...receipt } = previous;
          return { replayed: true, receipt };
        }
        const p = await tx.prescription.findUnique({
          where: { id },
          include: { items: true },
        });
        if (!p) throw new NotFoundException("Prescription not found.");
        if (p.status !== "ISSUED" || !p.issuedAt)
          throw new ConflictException(
            "Only an issued, unreplaced prescription can be dispensed.",
          );
        if (p.version !== dto.expectedPrescriptionVersion)
          throw new ConflictException(
            "Prescription changed. Reload and review.",
          );
        if (!p.patientName || !p.patientMrn || !p.items.length)
          throw new ConflictException(
            "Prescription lacks issued patient details or medicine lines.",
          );
        await tx.$queryRaw(
          Prisma.sql`SELECT id FROM "Medicine" WHERE id IN (${Prisma.join([...new Set(p.items.map((x) => x.medicineId))].sort().map((x) => Prisma.sql`${x}::uuid`))}) ORDER BY id FOR SHARE`,
        );
        const lots = await tx.pharmacyStockLot.findMany({
          where: { id: { in: allocations.map((x) => x.stockLotId) } },
          include: { medicine: { select: { isActive: true } } },
        });
        const usedLots = await tx.pharmacyDispenseItem.groupBy({
          by: ["stockLotId"],
          where: { stockLotId: { in: lots.map((x) => x.id) } },
          _sum: { quantity: true },
        });
        const usedItems = await tx.pharmacyDispenseItem.groupBy({
          by: ["prescriptionItemId"],
          where: { prescriptionItemId: { in: p.items.map((x) => x.id) } },
          _sum: { quantity: true },
        });
        const lotRequested = new Map<string, Prisma.Decimal>(),
          itemRequested = new Map<string, Prisma.Decimal>();
        const today = hospitalDate();
        const lines = allocations.map((a) => {
          const item = p.items.find((x) => x.id === a.prescriptionItemId);
          const lot = lots.find((x) => x.id === a.stockLotId);
          if (!item || !lot)
            throw new NotFoundException(
              "Prescribed item or stock lot not found.",
            );
          if (!lot.medicine.isActive)
            throw new ConflictException(
              "Medicine is inactive. Review with the prescriber.",
            );
          assertLotMatches(lot, item, today);
          const amount = new Prisma.Decimal(a.quantity);
          lotRequested.set(
            lot.id,
            (lotRequested.get(lot.id) ?? new Prisma.Decimal(0)).plus(amount),
          );
          itemRequested.set(
            item.id,
            (itemRequested.get(item.id) ?? new Prisma.Decimal(0)).plus(amount),
          );
          return {
            prescriptionItemId: item.id,
            stockLotId: lot.id,
            quantity: amount,
            quantityUnit: unit(item.quantityUnit),
            medicineName: item.medicineName,
            strength: item.strength,
            dosageForm: item.dosageForm,
            batchNumber: lot.batchNumber,
            expiryDate: lot.expiryDate,
          };
        });
        for (const [lotId, amount] of lotRequested) {
          const lot = lots.find((x) => x.id === lotId)!;
          const used =
            usedLots.find((x) => x.stockLotId === lotId)?._sum.quantity ?? 0;
          assertCapacity(
            amount,
            lot.receivedQuantity.minus(used),
            "Insufficient stock. Reload stock and review.",
          );
        }
        for (const [itemId, amount] of itemRequested) {
          const item = p.items.find((x) => x.id === itemId)!;
          const used =
            usedItems.find((x) => x.prescriptionItemId === itemId)?._sum
              .quantity ?? 0;
          assertCapacity(
            amount,
            item.quantity.minus(used),
            "Quantity exceeds the remaining prescribed quantity. Reload and review.",
          );
        }
        const receipt = await tx.pharmacyDispense.create({
          data: {
            prescriptionId: p.id,
            dispensedByStaffId: actorId,
            idempotencyKey,
            requestHash,
            patientName: p.patientName,
            patientMrn: p.patientMrn,
            notes: dto.notes?.trim() || null,
            items: { create: lines },
          },
          select: receiptFields,
        });
        await tx.auditEvent.create({
          data: {
            actorStaffId: actorId,
            action: "PHARMACY_PRESCRIPTION_DISPENSED",
            resourceType: "PharmacyDispense",
            resourceId: receipt.id,
          },
        });
        return { replayed: false, receipt };
      },
      { isolationLevel: "ReadCommitted", maxWait: 5000, timeout: 15000 },
    );
  }
}
