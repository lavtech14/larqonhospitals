import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { createHash } from "node:crypto";
import { DatabaseService } from "../database/database.service.js";
import { Prisma, BillingKind } from "../generated/prisma/client.js";
import type {
  BillingListDto,
  CancelBillingDraftDto,
  CreateBillingInvoiceDto,
  IssueBillingInvoiceDto,
  RecordBillingPaymentDto,
  SaveBillingPriceDto,
} from "./billing.dto.js";
import {
  assertPayment,
  billingUnit,
  formatMoney,
  lineAmount,
  MAX_TOTAL,
  money,
} from "./billing.rules.js";
import { hospitalDate } from "../pharmacy/pharmacy.rules.js";
type Tx = Prisma.TransactionClient;
type Source = {
  id: string;
  kind: BillingKind;
  entityId: string;
  patientId: string;
  description: string;
  quantity: string;
  quantityUnit: string;
  happenedAt: Date;
};
function priceKey(kind: BillingKind, id: string, unit: string) {
  return `${kind}:${id.toLowerCase()}${kind === "MEDICINE" ? ":" + billingUnit(unit) : ""}`;
}
function sourceKey(kind: BillingKind, id: string) {
  return `${kind}:${id.toLowerCase()}`;
}
function search(value: string | undefined) {
  return value?.trim().replace(/[\\%_]/g, "\\$&");
}
function page(query: BillingListDto, total: number) {
  return {
    page: query.page,
    limit: query.limit,
    total,
    totalPages: Math.ceil(total / query.limit),
  };
}
const priceSelect = {
  id: true,
  catalogueKey: true,
  kind: true,
  doctorId: true,
  labTestId: true,
  medicineId: true,
  displayName: true,
  quantityUnit: true,
  unitPriceMinor: true,
  isActive: true,
  version: true,
} satisfies Prisma.BillingPriceSelect;
function publicPrice(
  p: Prisma.BillingPriceGetPayload<{ select: typeof priceSelect }>,
) {
  const { unitPriceMinor, ...rest } = p;
  return { ...rest, unitPrice: formatMoney(unitPriceMinor) };
}
@Injectable()
export class BillingService {
  constructor(private readonly database: DatabaseService) {}
  private async mutate(
    actorId: string,
    key: string,
    operation: string,
    body: unknown,
    run: (tx: Tx) => Promise<Record<string, string>>,
  ) {
    const requestHash = createHash("sha256")
      .update(JSON.stringify({ operation, body }))
      .digest("hex");
    try {
      return await this.database.$transaction(
        async (tx) => {
          await tx.$queryRaw`SELECT pg_advisory_xact_lock(784211)::text AS "lockResult"`;
          const previous = await tx.billingRequest.findUnique({
            where: {
              actorStaffId_key: {
                actorStaffId: actorId,
                key: key.toLowerCase(),
              },
            },
          });
          if (previous) {
            if (previous.requestHash !== requestHash)
              throw new ConflictException(
                "This request key belongs to another billing action.",
              );
            return {
              ...(previous.response as Record<string, string>),
              replayed: true,
            };
          }
          const response = await run(tx);
          await tx.billingRequest.create({
            data: {
              actorStaffId: actorId,
              key: key.toLowerCase(),
              requestHash,
              response,
            },
          });
          await tx.auditEvent.create({
            data: {
              actorStaffId: actorId,
              action: operation,
              resourceType: "Billing",
              resourceId:
                response.invoiceId ?? response.priceId ?? response.paymentId,
            },
          });
          return { ...response, replayed: false };
        },
        { isolationLevel: "ReadCommitted", maxWait: 5000, timeout: 15000 },
      );
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === "P2002"
      )
        throw new ConflictException(
          "The price, source charge, payment reference, or billing record already exists. Reload and review.",
        );
      throw e;
    }
  }
  async patients(query: BillingListDto) {
    const term = search(query.search);
    const where: Prisma.PatientWhereInput = term
      ? {
          OR: [
            { fullName: { contains: term, mode: "insensitive" } },
            { mrn: { contains: term, mode: "insensitive" } },
          ],
        }
      : {};
    const [items, total] = await this.database.$transaction(
      [
        this.database.patient.findMany({
          where,
          select: { id: true, fullName: true, mrn: true },
          orderBy: [{ fullName: "asc" }, { id: "asc" }],
          skip: (query.page - 1) * query.limit,
          take: query.limit,
        }),
        this.database.patient.count({ where }),
      ],
      { isolationLevel: "RepeatableRead" },
    );
    return { items, pagination: page(query, total) };
  }
  async catalogue(query: BillingListDto) {
    const kind = query.kind ?? "CONSULTATION",
      term = search(query.search),
      skip = (query.page - 1) * query.limit,
      take = query.limit;
    return this.database.$transaction(
      async (tx) => {
        if (kind === "CONSULTATION") {
          const where: Prisma.DoctorProfileWhereInput = {
            isActive: true,
            department: { isActive: true },
            ...(term
              ? { displayName: { contains: term, mode: "insensitive" } }
              : {}),
          };
          const [items, total] = await Promise.all([
            tx.doctorProfile.findMany({
              where,
              select: { id: true, displayName: true },
              orderBy: [{ displayName: "asc" }, { id: "asc" }],
              skip,
              take,
            }),
            tx.doctorProfile.count({ where }),
          ]);
          return { items, pagination: page(query, total) };
        }
        if (kind === "LAB") {
          const where: Prisma.LabTestWhereInput = {
            isActive: true,
            ...(term
              ? { displayName: { contains: term, mode: "insensitive" } }
              : {}),
          };
          const [items, total] = await Promise.all([
            tx.labTest.findMany({
              where,
              select: { id: true, displayName: true, code: true },
              orderBy: [{ displayName: "asc" }, { id: "asc" }],
              skip,
              take,
            }),
            tx.labTest.count({ where }),
          ]);
          return { items, pagination: page(query, total) };
        }
        const where: Prisma.MedicineWhereInput = {
          isActive: true,
          ...(term
            ? { displayName: { contains: term, mode: "insensitive" } }
            : {}),
        };
        const [items, total] = await Promise.all([
          tx.medicine.findMany({
            where,
            select: {
              id: true,
              displayName: true,
              code: true,
              strength: true,
              dosageForm: true,
            },
            orderBy: [{ displayName: "asc" }, { id: "asc" }],
            skip,
            take,
          }),
          tx.medicine.count({ where }),
        ]);
        return { items, pagination: page(query, total) };
      },
      { isolationLevel: "RepeatableRead" },
    );
  }
  async prices(query: BillingListDto) {
    const term = search(query.search);
    const where: Prisma.BillingPriceWhereInput = {
      ...(query.kind ? { kind: query.kind } : {}),
      ...(term ? { displayName: { contains: term, mode: "insensitive" } } : {}),
    };
    const [items, total] = await this.database.$transaction(
      [
        this.database.billingPrice.findMany({
          where,
          select: priceSelect,
          orderBy: [{ displayName: "asc" }, { id: "asc" }],
          skip: (query.page - 1) * query.limit,
          take: query.limit,
        }),
        this.database.billingPrice.count({ where }),
      ],
      { isolationLevel: "RepeatableRead" },
    );
    return { items: items.map(publicPrice), pagination: page(query, total) };
  }
  savePrice(
    id: string | undefined,
    actorId: string,
    key: string,
    dto: SaveBillingPriceDto,
  ) {
    const amount = money(dto.unitPrice, true),
      unit = billingUnit(dto.quantityUnit),
      entityId = dto.entityId.toLowerCase();
    if (
      !unit ||
      (dto.kind === "CONSULTATION" && unit !== "consultation") ||
      (dto.kind === "LAB" && unit !== "test")
    )
      throw new BadRequestException(
        "Use consultation/test units for service fees, or the exact medicine dispensing unit.",
      );
    const catalogueKey = priceKey(dto.kind, entityId, unit);
    return this.mutate(
      actorId,
      key,
      "BILLING_PRICE_SAVED",
      {
        id: id ?? null,
        kind: dto.kind,
        entityId,
        unit,
        amount: amount.toString(),
        isActive: dto.isActive,
        expectedVersion: dto.expectedVersion ?? null,
      },
      async (tx) => {
        let displayName: string;
        if (dto.kind === "CONSULTATION") {
          const entity = await tx.doctorProfile.findUnique({
            where: { id: entityId },
            select: { displayName: true, isActive: true },
          });
          if (!entity || (dto.isActive && !entity.isActive))
            throw new ConflictException("Choose an active doctor.");
          displayName = entity.displayName;
        } else if (dto.kind === "LAB") {
          const entity = await tx.labTest.findUnique({
            where: { id: entityId },
            select: { displayName: true, isActive: true },
          });
          if (!entity || (dto.isActive && !entity.isActive))
            throw new ConflictException("Choose an active lab test.");
          displayName = entity.displayName;
        } else {
          const entity = await tx.medicine.findUnique({
            where: { id: entityId },
            select: {
              displayName: true,
              isActive: true,
              strength: true,
              dosageForm: true,
            },
          });
          if (!entity || (dto.isActive && !entity.isActive))
            throw new ConflictException("Choose an active medicine.");
          displayName = `${entity.displayName} · ${entity.strength} · ${entity.dosageForm}`;
        }
        const data = {
          catalogueKey,
          kind: dto.kind,
          doctorId: dto.kind === "CONSULTATION" ? entityId : null,
          labTestId: dto.kind === "LAB" ? entityId : null,
          medicineId: dto.kind === "MEDICINE" ? entityId : null,
          displayName,
          quantityUnit: unit,
          unitPriceMinor: amount,
          isActive: dto.isActive,
          editedByStaffId: actorId,
        };
        if (!id) {
          if (dto.expectedVersion !== undefined)
            throw new BadRequestException(
              "A new price does not use an expected version.",
            );
          const price = await tx.billingPrice.create({ data });
          return { priceId: price.id };
        }
        const existing = await tx.billingPrice.findUnique({ where: { id } });
        if (!existing) throw new NotFoundException("Price not found.");
        if (existing.catalogueKey !== catalogueKey)
          throw new ConflictException(
            "A price cannot be moved to a different service or unit. Create a new entry.",
          );
        if (existing.version !== dto.expectedVersion)
          throw new ConflictException(
            "Price changed. Reload it before editing.",
          );
        await tx.billingPrice.update({
          where: { id },
          data: { ...data, version: { increment: 1 } },
        });
        return { priceId: id };
      },
    );
  }
  private async source(tx: Tx, kind: BillingKind, id: string): Promise<Source> {
    if (kind === "CONSULTATION") {
      const a = await tx.appointment.findUnique({
        where: { id },
        select: {
          id: true,
          patientId: true,
          doctorId: true,
          status: true,
          startsAt: true,
          doctor: { select: { displayName: true } },
        },
      });
      if (!a || a.status !== "BOOKED")
        throw new ConflictException(
          "Consultation source is unavailable or cancelled.",
        );
      return {
        id: a.id,
        kind,
        entityId: a.doctorId,
        patientId: a.patientId,
        description: `Consultation · ${a.doctor.displayName}`,
        quantity: "1.00",
        quantityUnit: "consultation",
        happenedAt: a.startsAt,
      };
    }
    if (kind === "LAB") {
      const item = await tx.labOrderItem.findUnique({
        where: { id },
        select: {
          id: true,
          labTestId: true,
          testName: true,
          order: {
            select: {
              status: true,
              orderedAt: true,
              encounter: {
                select: { appointment: { select: { patientId: true } } },
              },
            },
          },
        },
      });
      if (!item || item.order.status === "CANCELLED")
        throw new ConflictException(
          "Ordered lab test is unavailable or cancelled.",
        );
      return {
        id: item.id,
        kind,
        entityId: item.labTestId,
        patientId: item.order.encounter.appointment.patientId,
        description: item.testName,
        quantity: "1.00",
        quantityUnit: "test",
        happenedAt: item.order.orderedAt,
      };
    }
    const item = await tx.pharmacyDispenseItem.findUnique({
      where: { id },
      select: {
        id: true,
        quantity: true,
        quantityUnit: true,
        medicineName: true,
        strength: true,
        dosageForm: true,
        prescriptionItem: { select: { medicineId: true } },
        dispense: {
          select: {
            dispensedAt: true,
            prescription: {
              select: {
                encounter: {
                  select: { appointment: { select: { patientId: true } } },
                },
              },
            },
          },
        },
      },
    });
    if (!item)
      throw new ConflictException("Dispensed medicine source is unavailable.");
    return {
      id: item.id,
      kind,
      entityId: item.prescriptionItem.medicineId,
      patientId: item.dispense.prescription.encounter.appointment.patientId,
      description: `${item.medicineName} · ${item.strength} · ${item.dosageForm}`,
      quantity: item.quantity.toFixed(2),
      quantityUnit: billingUnit(item.quantityUnit),
      happenedAt: item.dispense.dispensedAt,
    };
  }
  async charges(patientId: string, query: BillingListDto) {
    const kind = query.kind ?? "CONSULTATION",
      skip = (query.page - 1) * query.limit,
      take = query.limit;
    return this.database.$transaction(
      async (tx) => {
        const patient = await tx.patient.findUnique({
          where: { id: patientId },
          select: { id: true, fullName: true, mrn: true },
        });
        if (!patient) throw new NotFoundException("Patient not found.");
        let ids: { id: string }[], total: number;
        if (kind === "CONSULTATION") {
          const where = { patientId, status: "BOOKED" as const };
          [ids, total] = await Promise.all([
            tx.appointment.findMany({
              where,
              select: { id: true },
              orderBy: [{ startsAt: "desc" }, { id: "desc" }],
              skip,
              take,
            }),
            tx.appointment.count({ where }),
          ]);
        } else if (kind === "LAB") {
          const where: Prisma.LabOrderItemWhereInput = {
            order: {
              status: { not: "CANCELLED" },
              encounter: { appointment: { patientId } },
            },
          };
          [ids, total] = await Promise.all([
            tx.labOrderItem.findMany({
              where,
              select: { id: true },
              orderBy: { id: "desc" },
              skip,
              take,
            }),
            tx.labOrderItem.count({ where }),
          ]);
        } else {
          const where: Prisma.PharmacyDispenseItemWhereInput = {
            dispense: {
              prescription: { encounter: { appointment: { patientId } } },
            },
          };
          [ids, total] = await Promise.all([
            tx.pharmacyDispenseItem.findMany({
              where,
              select: { id: true },
              orderBy: { id: "desc" },
              skip,
              take,
            }),
            tx.pharmacyDispenseItem.count({ where }),
          ]);
        }
        const sources: Source[] = [];
        for (const item of ids)
          sources.push(await this.source(tx, kind, item.id));
        const prices = await tx.billingPrice.findMany({
          where: {
            isActive: true,
            catalogueKey: {
              in: sources.map((s) =>
                priceKey(s.kind, s.entityId, s.quantityUnit),
              ),
            },
          },
          select: priceSelect,
        });
        const reserved = await tx.billingInvoiceLine.findMany({
          where: {
            reservedKey: { in: sources.map((s) => sourceKey(s.kind, s.id)) },
          },
          select: { reservedKey: true, invoiceId: true },
        });
        return {
          patient,
          items: sources.map((s) => {
            const price = prices.find(
              (p) =>
                p.catalogueKey === priceKey(s.kind, s.entityId, s.quantityUnit),
            );
            return {
              ...s,
              price: price ? publicPrice(price) : null,
              lineAmount: price
                ? formatMoney(lineAmount(price.unitPriceMinor, s.quantity))
                : null,
              reservedInvoiceId:
                reserved.find((r) => r.reservedKey === sourceKey(s.kind, s.id))
                  ?.invoiceId ?? null,
            };
          }),
          pagination: page(query, total),
        };
      },
      { isolationLevel: "RepeatableRead", timeout: 15000 },
    );
  }
  create(actorId: string, key: string, dto: CreateBillingInvoiceDto) {
    const lines = dto.lines
      .map((x) => ({
        ...x,
        sourceId: x.sourceId.toLowerCase(),
        priceId: x.priceId.toLowerCase(),
      }))
      .sort((a, b) =>
        sourceKey(a.kind, a.sourceId).localeCompare(
          sourceKey(b.kind, b.sourceId),
        ),
      );
    if (
      !lines.length ||
      lines.length > 100 ||
      new Set(lines.map((l) => sourceKey(l.kind, l.sourceId))).size !==
        lines.length
    )
      throw new BadRequestException("Choose 1–100 distinct source charges.");
    const patientId = dto.patientId.toLowerCase(),
      notes = dto.notes?.trim() || null;
    return this.mutate(
      actorId,
      key,
      "BILLING_DRAFT_CREATED",
      { patientId, notes, lines },
      async (tx) => {
        const patient = await tx.patient.findUnique({
          where: { id: patientId },
          select: { id: true, fullName: true, mrn: true },
        });
        if (!patient) throw new NotFoundException("Patient not found.");
        const items = [];
        let total = 0n;
        for (const [position, selection] of lines.entries()) {
          const s = await this.source(tx, selection.kind, selection.sourceId);
          if (s.patientId !== patientId)
            throw new ConflictException("Source belongs to another patient.");
          const price = await tx.billingPrice.findUnique({
            where: { id: selection.priceId },
          });
          if (
            !price?.isActive ||
            price.version !== selection.expectedPriceVersion ||
            price.catalogueKey !== priceKey(s.kind, s.entityId, s.quantityUnit)
          )
            throw new ConflictException(
              "Price changed or does not match this service and unit. Reload charges.",
            );
          const amount = lineAmount(price.unitPriceMinor, s.quantity);
          total += amount;
          if (total > MAX_TOTAL)
            throw new BadRequestException(
              "Invoice total exceeds the supported range.",
            );
          items.push({
            position,
            kind: s.kind,
            sourceKey: sourceKey(s.kind, s.id),
            reservedKey: sourceKey(s.kind, s.id),
            appointmentId: s.kind === "CONSULTATION" ? s.id : null,
            labOrderItemId: s.kind === "LAB" ? s.id : null,
            dispenseItemId: s.kind === "MEDICINE" ? s.id : null,
            description: s.description,
            quantity: s.quantity,
            quantityUnit: s.quantityUnit,
            unitPriceMinor: price.unitPriceMinor,
            amountMinor: amount,
            priceId: price.id,
            priceVersion: price.version,
          });
        }
        const invoice = await tx.billingInvoice.create({
          data: {
            patientId,
            patientName: patient.fullName,
            patientMrn: patient.mrn,
            totalMinor: total,
            notes,
            createdByStaffId: actorId,
            lines: { create: items },
          },
        });
        return { invoiceId: invoice.id };
      },
    );
  }
  private async nextNumber(tx: Tx, type: "INVOICE" | "RECEIPT") {
    const year = hospitalDate().slice(0, 4),
      counter = await tx.billingCounter.upsert({
        where: { key: `${type}:${year}` },
        create: { key: `${type}:${year}`, value: 1 },
        update: { value: { increment: 1 } },
      });
    return `${type === "INVOICE" ? "LHQ" : "LHR"}-${year}-${String(counter.value).padStart(6, "0")}`;
  }
  issue(id: string, actorId: string, key: string, dto: IssueBillingInvoiceDto) {
    if (dto.reviewConfirmed !== true)
      throw new BadRequestException("Confirm review before issuing.");
    return this.mutate(
      actorId,
      key,
      "BILLING_INVOICE_ISSUED",
      { id, version: dto.expectedVersion, reviewConfirmed: true },
      async (tx) => {
        const invoice = await tx.billingInvoice.findUnique({
          where: { id },
          include: { lines: true },
        });
        if (!invoice) throw new NotFoundException("Invoice not found.");
        if (
          invoice.status !== "DRAFT" ||
          invoice.version !== dto.expectedVersion
        )
          throw new ConflictException(
            "Invoice is no longer the reviewed draft. Reload it.",
          );
        if (!invoice.lines.length)
          throw new ConflictException("Invoice has no charges.");
        for (const line of invoice.lines) {
          const source = await this.source(
            tx,
            line.kind,
            (line.appointmentId ?? line.labOrderItemId ?? line.dispenseItemId)!,
          );
          if (
            source.patientId !== invoice.patientId ||
            source.quantity !== line.quantity ||
            line.reservedKey !== line.sourceKey
          )
            throw new ConflictException(
              "Invoice source changed. Cancel the draft and review charges.",
            );
        }
        const invoiceNumber = await this.nextNumber(tx, "INVOICE");
        await tx.billingInvoice.update({
          where: { id },
          data: {
            status: "ISSUED",
            invoiceNumber,
            issuedAt: new Date(),
            issuedByStaffId: actorId,
            version: { increment: 1 },
          },
        });
        return { invoiceId: id, invoiceNumber };
      },
    );
  }
  cancel(id: string, actorId: string, key: string, dto: CancelBillingDraftDto) {
    const reason = dto.reason.trim();
    if (!reason)
      throw new BadRequestException("A cancellation reason is required.");
    return this.mutate(
      actorId,
      key,
      "BILLING_DRAFT_CANCELLED",
      { id, version: dto.expectedVersion, reason },
      async (tx) => {
        const invoice = await tx.billingInvoice.findUnique({ where: { id } });
        if (!invoice) throw new NotFoundException("Invoice not found.");
        if (
          invoice.status !== "DRAFT" ||
          invoice.version !== dto.expectedVersion
        )
          throw new ConflictException(
            "Only the current draft can be cancelled.",
          );
        await tx.billingInvoiceLine.updateMany({
          where: { invoiceId: id },
          data: { reservedKey: null },
        });
        await tx.billingInvoice.update({
          where: { id },
          data: {
            status: "CANCELLED",
            cancellationReason: reason,
            cancelledAt: new Date(),
            cancelledByStaffId: actorId,
            version: { increment: 1 },
          },
        });
        return { invoiceId: id };
      },
    );
  }
  pay(id: string, actorId: string, key: string, dto: RecordBillingPaymentDto) {
    if (dto.receiptConfirmed !== true)
      throw new BadRequestException("Confirm actual receipt of payment.");
    const amount = money(dto.amount),
      reference = dto.externalReference?.trim().toUpperCase() || null,
      notes = dto.notes?.trim() || null;
    if (dto.method === "CASH" && reference)
      throw new BadRequestException(
        "Cash payments do not use an external transaction reference.",
      );
    if (dto.method !== "CASH" && !reference)
      throw new BadRequestException(
        "UPI and card payments require a transaction reference.",
      );
    return this.mutate(
      actorId,
      key,
      "BILLING_PAYMENT_RECORDED",
      {
        id,
        version: dto.expectedVersion,
        amount: amount.toString(),
        method: dto.method,
        reference,
        notes,
        receiptConfirmed: true,
      },
      async (tx) => {
        const invoice = await tx.billingInvoice.findUnique({ where: { id } });
        if (!invoice) throw new NotFoundException("Invoice not found.");
        if (
          invoice.status !== "ISSUED" ||
          invoice.version !== dto.expectedVersion
        )
          throw new ConflictException(
            "Invoice changed or is not issued. Reload before recording payment.",
          );
        const sums = await tx.billingPayment.aggregate({
          where: { invoiceId: id },
          _sum: { amountMinor: true },
        });
        assertPayment(invoice.totalMinor, sums._sum.amountMinor ?? 0n, amount);
        const receiptNumber = await this.nextNumber(tx, "RECEIPT");
        const payment = await tx.billingPayment.create({
          data: {
            invoiceId: id,
            receiptNumber,
            method: dto.method,
            amountMinor: amount,
            externalReference: reference,
            referenceKey: reference ? `${dto.method}:${reference}` : null,
            notes,
            recordedByStaffId: actorId,
          },
        });
        await tx.billingInvoice.update({
          where: { id },
          data: { version: { increment: 1 } },
        });
        return {
          invoiceId: id,
          paymentId: payment.id,
          receiptNumber,
          amount: formatMoney(amount),
        };
      },
    );
  }
  async list(query: BillingListDto) {
    const term = search(query.search);
    const where: Prisma.BillingInvoiceWhereInput = term
      ? {
          OR: [
            { patientName: { contains: term, mode: "insensitive" } },
            { patientMrn: { contains: term, mode: "insensitive" } },
            { invoiceNumber: { contains: term, mode: "insensitive" } },
          ],
        }
      : {};
    return this.database.$transaction(
      async (tx) => {
        const invoices = await tx.billingInvoice.findMany({
          where,
          select: {
            id: true,
            patientName: true,
            patientMrn: true,
            invoiceNumber: true,
            status: true,
            totalMinor: true,
            createdAt: true,
            issuedAt: true,
            version: true,
          },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          skip: (query.page - 1) * query.limit,
          take: query.limit,
        });
        const sums = await tx.billingPayment.groupBy({
          by: ["invoiceId"],
          where: { invoiceId: { in: invoices.map((i) => i.id) } },
          _sum: { amountMinor: true },
        });
        const total = await tx.billingInvoice.count({ where });
        return {
          items: invoices.map(({ totalMinor, ...i }) => {
            const paid =
              sums.find((p) => p.invoiceId === i.id)?._sum.amountMinor ?? 0n;
            return {
              ...i,
              currency: "INR",
              total: formatMoney(totalMinor),
              paid: formatMoney(paid),
              outstanding:
                i.status === "ISSUED" ? formatMoney(totalMinor - paid) : "0.00",
              paymentStatus:
                i.status !== "ISSUED"
                  ? "NOT_APPLICABLE"
                  : paid === totalMinor
                    ? "PAID"
                    : paid > 0n
                      ? "PARTIALLY_PAID"
                      : "UNPAID",
            };
          }),
          pagination: page(query, total),
        };
      },
      { isolationLevel: "RepeatableRead" },
    );
  }
  async detail(id: string) {
    return this.database.$transaction(
      async (tx) => {
        const invoice = await tx.billingInvoice.findUnique({
          where: { id },
          include: {
            createdBy: { select: { fullName: true } },
            issuedBy: { select: { fullName: true } },
            lines: { orderBy: { position: "asc" } },
            payments: {
              orderBy: [{ recordedAt: "desc" }, { id: "desc" }],
              include: { recordedBy: { select: { fullName: true } } },
            },
          },
        });
        if (!invoice) throw new NotFoundException("Invoice not found.");
        const { totalMinor, lines, payments, ...rest } = invoice;
        const paid = payments.reduce((sum, p) => sum + p.amountMinor, 0n);
        return {
          ...rest,
          total: formatMoney(totalMinor),
          paid: formatMoney(paid),
          outstanding:
            invoice.status === "ISSUED"
              ? formatMoney(totalMinor - paid)
              : "0.00",
          paymentStatus:
            invoice.status !== "ISSUED"
              ? "NOT_APPLICABLE"
              : paid === totalMinor
                ? "PAID"
                : paid > 0n
                  ? "PARTIALLY_PAID"
                  : "UNPAID",
          lines: lines.map(({ unitPriceMinor, amountMinor, ...line }) => ({
            ...line,
            unitPrice: formatMoney(unitPriceMinor),
            amount: formatMoney(amountMinor),
          })),
          payments: payments.map(({ amountMinor, ...payment }) => ({
            ...payment,
            amount: formatMoney(amountMinor),
          })),
          timeZone: "Asia/Kolkata",
        };
      },
      { isolationLevel: "RepeatableRead", timeout: 15000 },
    );
  }
}
