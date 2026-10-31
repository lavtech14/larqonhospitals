import { BadRequestException } from "@nestjs/common";

export type LabParameter = {
  code: string;
  name: string;
  kind: "NUMERIC" | "TEXT";
  unit: string;
  referenceText: string;
  required: boolean;
};
export type ResultFlag = "NOT_FLAGGED" | "NORMAL" | "LOW" | "HIGH" | "ABNORMAL";
export type ResultInput = { code: string; value: string; flag: ResultFlag };
export type ResultValue = LabParameter & { value: string; flag: ResultFlag };
const flags = ["NOT_FLAGGED", "NORMAL", "LOW", "HIGH", "ABNORMAL"];
const object = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const text = (
  value: unknown,
  label: string,
  maximum: number,
  required = false,
) => {
  if (typeof value !== "string")
    throw new BadRequestException(`${label} must be text.`);
  const normalized = value.trim();
  if ((required && !normalized) || normalized.length > maximum)
    throw new BadRequestException(`Invalid ${label}.`);
  return normalized;
};

export function normalizeParameters(input: unknown): LabParameter[] {
  if (!Array.isArray(input) || input.length > 50)
    throw new BadRequestException("Configure at most 50 test parameters.");
  const codes = new Set<string>();
  return input.map((entry): LabParameter => {
    if (!object(entry))
      throw new BadRequestException("Invalid test parameter.");
    const code = text(entry.code, "parameter code", 40, true).toUpperCase();
    if (!/^[A-Z0-9_-]+$/.test(code) || codes.has(code))
      throw new BadRequestException(
        "Parameter codes must be valid and unique within a test.",
      );
    codes.add(code);
    if (entry.kind !== "NUMERIC" && entry.kind !== "TEXT")
      throw new BadRequestException("Choose numeric or text parameter type.");
    if (typeof entry.required !== "boolean")
      throw new BadRequestException(
        "Specify whether the parameter is required.",
      );
    return {
      code,
      name: text(entry.name, "parameter name", 100, true),
      kind: entry.kind,
      unit: text(entry.unit, "unit", 50),
      referenceText: text(entry.referenceText, "reference text", 500),
      required: entry.required,
    };
  });
}

/** Metadata always comes from the order's frozen definitions, never the client. */
export function buildResultValues(
  definitions: unknown,
  input: unknown,
  narrative: string,
): ResultValue[] {
  const parameters = normalizeParameters(definitions);
  if (!Array.isArray(input) || input.length > 50)
    throw new BadRequestException("Invalid structured result values.");
  const entries = new Map<string, { value: string; flag: ResultFlag }>();
  const allowed = new Set(parameters.map((parameter) => parameter.code));
  for (const entry of input) {
    if (!object(entry)) throw new BadRequestException("Invalid result entry.");
    const code = text(
      entry.code,
      "result parameter code",
      40,
      true,
    ).toUpperCase();
    if (!allowed.has(code) || entries.has(code))
      throw new BadRequestException(
        "Result parameters must match the ordered test and cannot repeat.",
      );
    const value = text(entry.value, "result value", 1000);
    if (typeof entry.flag !== "string" || !flags.includes(entry.flag))
      throw new BadRequestException("Invalid result flag.");
    if (!value && entry.flag !== "NOT_FLAGGED")
      throw new BadRequestException("A flag requires a recorded value.");
    entries.set(code, { value, flag: entry.flag as ResultFlag });
  }
  const result = parameters.map((parameter) => {
    const entry = entries.get(parameter.code) ?? {
      value: "",
      flag: "NOT_FLAGGED" as ResultFlag,
    };
    if (parameter.required && !entry.value)
      throw new BadRequestException(`Enter ${parameter.name}.`);
    if (
      parameter.kind === "NUMERIC" &&
      entry.value &&
      (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(entry.value) ||
        !Number.isFinite(Number(entry.value)))
    ) {
      throw new BadRequestException(
        `${parameter.name} requires a finite numeric value.`,
      );
    }
    return { ...parameter, ...entry };
  });
  if (!narrative.trim() && !result.some((entry) => entry.value))
    throw new BadRequestException(
      "Enter a narrative report or structured result values.",
    );
  return result;
}
