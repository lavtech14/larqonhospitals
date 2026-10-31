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
export type ResultValue = LabParameter & ResultInput;
export const resultFlags: ResultFlag[] = [
  "NOT_FLAGGED",
  "NORMAL",
  "LOW",
  "HIGH",
  "ABNORMAL",
];
export function resultInputs(
  parameters: LabParameter[],
  saved: ResultValue[] = [],
): ResultInput[] {
  return parameters.map((parameter) => {
    const value = saved.find((item) => item.code === parameter.code);
    return {
      code: parameter.code,
      value: value?.value ?? "",
      flag: value?.flag ?? "NOT_FLAGGED",
    };
  });
}
