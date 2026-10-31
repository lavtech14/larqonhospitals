import { BadRequestException, ConflictException } from "@nestjs/common";
export const MAX_TOTAL = 999_999_999_999n;
export function money(value: string, allowZero = false) {
  if (!/^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/.test(value))
    throw new BadRequestException(
      "Use an INR amount with at most two decimal places.",
    );
  const [whole, fraction = ""] = value.split(".");
  const result = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0"));
  if (result > MAX_TOTAL || (!allowZero && result === 0n))
    throw new BadRequestException("Amount is outside the supported range.");
  return result;
}
export function formatMoney(value: bigint) {
  if (value < 0n) throw new Error("Negative billing balance.");
  return `${value / 100n}.${(value % 100n).toString().padStart(2, "0")}`;
}
export function lineAmount(price: bigint, quantity: string) {
  if (!/^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/.test(quantity))
    throw new BadRequestException("Unsupported source quantity.");
  const q = money(quantity);
  const result = (price * q + 50n) / 100n;
  if (result > MAX_TOTAL)
    throw new BadRequestException("Line amount exceeds the supported range.");
  return result;
}
export function assertPayment(total: bigint, paid: bigint, amount: bigint) {
  if (amount <= 0n || amount > total - paid)
    throw new ConflictException(
      "Payment exceeds the outstanding balance or is not positive. Reload the invoice.",
    );
}
export function billingUnit(value: string) {
  return value.trim().toLowerCase();
}
