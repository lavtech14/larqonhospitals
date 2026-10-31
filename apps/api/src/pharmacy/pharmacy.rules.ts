import { BadRequestException, ConflictException } from "@nestjs/common";
import { Prisma } from "../generated/prisma/client.js";
export function quantity(value: string) {
  if (!/^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/.test(value))
    throw new BadRequestException(
      "Use a positive quantity with at most two decimal places.",
    );
  const result = new Prisma.Decimal(value);
  if (result.lte(0))
    throw new BadRequestException("Quantity must be greater than zero.");
  return result;
}
export function calendarDate(value: string) {
  const date = new Date(`${value}T00:00:00.000Z`);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    !Number.isFinite(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value
  )
    throw new BadRequestException("Invalid calendar date.");
  return date;
}
export function hospitalDate(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (type: string) => parts.find((x) => x.type === type)!.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}
export function unit(value: string) {
  return value.trim().toLowerCase();
}
export function assertCapacity(
  requested: Prisma.Decimal,
  available: Prisma.Decimal,
  message: string,
) {
  if (requested.gt(available)) throw new ConflictException(message);
}
export function assertLotMatches(
  lot: {
    medicineId: string;
    quantityUnit: string;
    medicineName: string | null;
    strength: string | null;
    dosageForm: string | null;
    expiryDate: Date;
  },
  item: {
    medicineId: string;
    quantityUnit: string;
    medicineName: string;
    strength: string;
    dosageForm: string;
  },
  today: string,
) {
  if (
    lot.medicineId !== item.medicineId ||
    unit(lot.quantityUnit) !== unit(item.quantityUnit)
  )
    throw new ConflictException(
      "Stock medicine or unit does not match the prescribed item. Unit conversion and substitution are not supported.",
    );
  if (
    lot.medicineName !== item.medicineName ||
    lot.strength !== item.strength ||
    lot.dosageForm !== item.dosageForm
  )
    throw new ConflictException(
      "Stock description differs from the issued prescription or lacks receipt snapshots. Review before dispensing.",
    );
  if (lot.expiryDate.toISOString().slice(0, 10) <= today)
    throw new ConflictException(
      "This lot has expired or expires today. Select another lot.",
    );
}
