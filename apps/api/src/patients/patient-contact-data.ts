import type { PatientPhoneOwner } from '../generated/prisma/enums.js';

const textFields = [
  'phoneContactName',
  'contactEmail',
  'guardianName',
  'guardianRelationship',
  'guardianPhone',
  'emergencyContactName',
  'emergencyContactRelationship',
  'emergencyContactPhone',
] as const;

type TextField = (typeof textFields)[number];

type ContactInput = Partial<Record<TextField, string | null>> & {
  phoneOwner?: PatientPhoneOwner;
};

export function patientContactData(dto: ContactInput) {
  const data: Partial<Record<TextField, string | null>> & {
    phoneOwner?: PatientPhoneOwner;
  } = {};

  for (const field of textFields) {
    const value = dto[field];

    if (value !== undefined) {
      data[field] = value?.trim() || null;
    }
  }

  if (dto.phoneOwner !== undefined) {
    data.phoneOwner = dto.phoneOwner;
  }

  return data;
}
