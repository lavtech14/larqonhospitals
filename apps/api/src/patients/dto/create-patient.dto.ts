import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  IsDateString,
  IsEnum,
  ValidateIf,
  IsEmail,
} from 'class-validator';

import {
  AdministrativeSex,
  PatientPhoneOwner,
} from '../../generated/prisma/enums.js';

function trimText({ value }: { value: unknown }) {
  return typeof value === 'string' ? value.trim() : value;
}

export class CreatePatientDto {
  @Transform(trimText)
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  fullName!: string;

  @Transform(trimText)
  @IsOptional()
  @IsString()
  @Matches(/^\+?[0-9]{7,15}$/, {
    message: 'phone must contain 7–15 digits with an optional leading +',
  })
  phone?: string;

  @Transform(trimText)
  @IsOptional()
  @IsString()
  @MaxLength(200)
  addressLine1?: string;

  @Transform(trimText)
  @IsOptional()
  @IsString()
  @MaxLength(200)
  addressLine2?: string;

  @Transform(trimText)
  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;

  @Transform(trimText)
  @IsOptional()
  @IsString()
  @MaxLength(100)
  district?: string;

  @Transform(trimText)
  @IsOptional()
  @IsString()
  @MaxLength(100)
  state?: string;

  @Transform(trimText)
  @IsOptional()
  @IsString()
  @MaxLength(20)
  postalCode?: string;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsOptional()
  @IsString()
  @Matches(/^[A-Z]{2}$/, {
    message: 'countryCode must contain two letters, for example IN',
  })
  countryCode?: string;

  @IsOptional()
  @IsBoolean()
  duplicateReviewConfirmed?: boolean;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @IsDateString({ strict: true })
  dateOfBirth?: string | null;

  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsEnum(AdministrativeSex)
  administrativeSex?: AdministrativeSex;
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsEnum(PatientPhoneOwner)
  phoneOwner?: PatientPhoneOwner;

  @Transform(trimText)
  @IsOptional()
  @IsString()
  @MaxLength(100)
  phoneContactName?: string | null;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsOptional()
  @IsEmail()
  @MaxLength(254)
  contactEmail?: string | null;

  @Transform(trimText)
  @IsOptional()
  @IsString()
  @MaxLength(100)
  guardianName?: string | null;

  @Transform(trimText)
  @IsOptional()
  @IsString()
  @MaxLength(50)
  guardianRelationship?: string | null;

  @Transform(trimText)
  @IsOptional()
  @IsString()
  @Matches(/^\+?[0-9]{7,15}$/)
  guardianPhone?: string | null;

  @Transform(trimText)
  @IsOptional()
  @IsString()
  @MaxLength(100)
  emergencyContactName?: string | null;

  @Transform(trimText)
  @IsOptional()
  @IsString()
  @MaxLength(50)
  emergencyContactRelationship?: string | null;

  @Transform(trimText)
  @IsOptional()
  @IsString()
  @Matches(/^\+?[0-9]{7,15}$/)
  emergencyContactPhone?: string | null;
}
