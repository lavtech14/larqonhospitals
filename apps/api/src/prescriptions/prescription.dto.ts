import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsInt,
  IsNumber,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
  Equals,
} from 'class-validator';

import { AllergyReviewStatus } from '../generated/prisma/enums.js';

export class CreatePrescriptionDto {
  @IsInt()
  @Min(1)
  expectedEncounterVersion!: number;
}

export class PrescriptionItemDto {
  @IsUUID()
  medicineId!: string;

  @IsInt()
  @Min(1)
  expectedMedicineVersion!: number;

  @IsString()
  @MaxLength(200)
  @Matches(/\S/)
  dose!: string;

  @IsString()
  @MaxLength(100)
  @Matches(/\S/)
  route!: string;

  @IsString()
  @MaxLength(200)
  @Matches(/\S/)
  frequency!: string;

  @IsString()
  @MaxLength(200)
  @Matches(/\S/)
  duration!: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(99999999.99)
  quantity!: number;

  @IsString()
  @MaxLength(50)
  @Matches(/\S/)
  quantityUnit!: string;

  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @MaxLength(1000)
  instructions?: string;
}

export class SavePrescriptionDto {
  @IsInt()
  @Min(1)
  expectedVersion!: number;

  @IsEnum(AllergyReviewStatus)
  allergyStatus!: AllergyReviewStatus;

  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @MaxLength(2000)
  allergyDetails?: string;

  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @MaxLength(2000)
  instructions?: string;

  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => PrescriptionItemDto)
  items!: PrescriptionItemDto[];
}

export class ListPrescriptionsDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10000)
  page = 1;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;
}

export class IssuePrescriptionDto {
  @IsInt()
  @Min(1)
  expectedVersion!: number;

  @Equals(true, {
    message: 'Confirm review before issuing.',
  })
  reviewConfirmed!: boolean;
}

export class DiscardPrescriptionDto {
  @IsInt()
  @Min(1)
  expectedVersion!: number;

  @IsString()
  @Matches(/\S/, {
    message: 'Enter a reason for discarding the draft.',
  })
  @MaxLength(1000)
  reason!: string;
}
