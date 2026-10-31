export type AllergyStatus =
  "NOT_REVIEWED" | "NO_KNOWN_ALLERGIES" | "ALLERGIES_REPORTED" | "UNKNOWN";

export type PrescriptionStatus = "DRAFT" | "ISSUED" | "CANCELLED" | "REPLACED";

export type Medicine = {
  id: string;
  code?: string;
  version: number;
  isActive: boolean;
  displayName: string;
  genericName: string | null;
  strength: string;
  dosageForm: string;
};

export type DraftRow = {
  clientId: string;
  medicine: Medicine | null;
  needsReselection: boolean;
  dose: string;
  route: string;
  frequency: string;
  duration: string;
  quantity: string;
  quantityUnit: string;
  instructions: string;
};

export type Draft = {
  allergyStatus: AllergyStatus;
  allergyDetails: string;
  instructions: string;
  rows: DraftRow[];
};

export type SavedItem = {
  id: string;
  medicineId: string;

  medicineName: string;
  genericName: string | null;
  strength: string;
  dosageForm: string;

  dose: string;
  route: string;
  frequency: string;
  duration: string;
  quantity: number;
  quantityUnit: string;
  instructions: string | null;

  medicine: Medicine;
};

export type Detail = {
  patient: {
    fullName: string;
    mrn: string;
  };

  encounter: {
    id: string;
    status: string;
    version: number;
  };

  prescription: {
    id: string;
    version: number;
    status: PrescriptionStatus;

    cancelledAt: string | null;
    cancellationReason: string | null;

    patientName: string | null;
    patientMrn: string | null;

    prescriberName: string | null;
    prescriberRegistrationNumber: string | null;
    prescriberRegistrationAuthority: string | null;

    issuedAt: string | null;

    authorStaffId: string;

    author: {
      id: string;
      fullName: string;
    };

    allergyStatus: AllergyStatus;
    allergyDetails: string | null;
    instructions: string | null;

    items: SavedItem[];
  };
};

export const allergyOptions = [
  ["NOT_REVIEWED", "Not reviewed"],
  ["NO_KNOWN_ALLERGIES", "No known allergies reported"],
  ["ALLERGIES_REPORTED", "Allergies reported"],
  ["UNKNOWN", "Unknown after review"],
] as const;

export function emptyRow(): DraftRow {
  return {
    clientId: crypto.randomUUID(),
    medicine: null,
    needsReselection: false,
    dose: "",
    route: "",
    frequency: "",
    duration: "",
    quantity: "",
    quantityUnit: "",
    instructions: "",
  };
}

export function fromDetail(data: Detail): Draft {
  const prescription = data.prescription;
  const isDraft = prescription.status === "DRAFT";

  return {
    allergyStatus: prescription.allergyStatus,
    allergyDetails: prescription.allergyDetails ?? "",
    instructions: prescription.instructions ?? "",

    rows: prescription.items.map((item) => ({
      clientId: item.id,

      // Keep the saved prescription wording.
      // The catalogue version remains available for draft validation.
      medicine: {
        ...item.medicine,
        id: item.medicineId,
        displayName: item.medicineName,
        genericName: item.genericName,
        strength: item.strength,
        dosageForm: item.dosageForm,
      },

      // Issued or closed records retain their historical wording.
      needsReselection:
        isDraft &&
        (!item.medicine.isActive ||
          item.medicineName !== item.medicine.displayName ||
          item.genericName !== item.medicine.genericName ||
          item.strength !== item.medicine.strength ||
          item.dosageForm !== item.medicine.dosageForm),

      dose: item.dose,
      route: item.route,
      frequency: item.frequency,
      duration: item.duration,
      quantity: String(item.quantity),
      quantityUnit: item.quantityUnit,
      instructions: item.instructions ?? "",
    })),
  };
}

function requiredText(value: string, label: string, maxLength: number): string {
  const text = value.trim();

  if (!text) {
    throw new Error(`Enter ${label}.`);
  }

  if (text.length > maxLength) {
    throw new Error(
      `${label} must contain no more than ${maxLength} characters.`,
    );
  }

  return text;
}

function optionalText(value: string, label: string, maxLength: number): string {
  const text = value.trim();

  if (text.length > maxLength) {
    throw new Error(
      `${label} must contain no more than ${maxLength} characters.`,
    );
  }

  return text;
}

export function buildSaveBody(draft: Draft, version: number): string {
  if (!Number.isInteger(version) || version < 1) {
    throw new Error(
      "The prescription version is unavailable. Refresh the prescription.",
    );
  }

  if (!allergyOptions.some(([value]) => value === draft.allergyStatus)) {
    throw new Error("Choose a valid allergy review status.");
  }

  if (draft.rows.length > 50) {
    throw new Error("A draft supports up to 50 medicine lines.");
  }

  const allergyDetails = optionalText(
    draft.allergyDetails,
    "Allergy review notes",
    2000,
  );

  const instructions = optionalText(
    draft.instructions,
    "General instructions",
    2000,
  );

  const items = draft.rows.map((row, index) => {
    const line = index + 1;
    const medicine = row.medicine;

    if (!medicine || row.needsReselection || !medicine.isActive) {
      throw new Error(
        `Select or reselect an active medicine for line ${line}.`,
      );
    }

    if (!Number.isInteger(medicine.version) || medicine.version < 1) {
      throw new Error(
        `Reselect the medicine for line ${line}; its catalogue version is unavailable.`,
      );
    }

    const quantityText = row.quantity.trim();

    // Allow plain decimal values with at most two decimal places.
    if (!/^\d+(?:\.\d{1,2})?$/.test(quantityText)) {
      throw new Error(
        `Enter a quantity with no more than two decimal places for line ${line}.`,
      );
    }

    const quantity = Number(quantityText);

    if (
      !Number.isFinite(quantity) ||
      quantity < 0.01 ||
      quantity > 99999999.99
    ) {
      throw new Error(
        `Quantity for line ${line} must be between 0.01 and 99999999.99.`,
      );
    }

    return {
      medicineId: medicine.id,
      expectedMedicineVersion: medicine.version,

      dose: requiredText(row.dose, `dose for line ${line}`, 200),

      route: requiredText(row.route, `route for line ${line}`, 100),

      frequency: requiredText(row.frequency, `frequency for line ${line}`, 200),

      duration: requiredText(row.duration, `duration for line ${line}`, 200),

      quantity,

      quantityUnit: requiredText(
        row.quantityUnit,
        `quantity unit for line ${line}`,
        50,
      ),

      instructions: optionalText(
        row.instructions,
        `Instructions for line ${line}`,
        1000,
      ),
    };
  });

  return JSON.stringify({
    expectedVersion: version,
    allergyStatus: draft.allergyStatus,
    allergyDetails,
    instructions,
    items,
  });
}
