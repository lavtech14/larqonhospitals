import { Transform } from 'class-transformer';

import {
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';

function trimText({ value }: { value: unknown }): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

function queryInteger({ value }: { value: unknown }): unknown {
  return typeof value === 'string' && /^\d+$/.test(value)
    ? Number(value)
    : value;
}

/*
 * Doctor assignment:
 * patient + nurse + dates + reason + optional notes.
 *
 * The signed-in doctor is determined by the API.
 */
export class CreateRpmAssignmentDto {
  @IsUUID()
  patientId!: string;

  @IsUUID()
  nurseStaffId!: string;

  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'Start date must use YYYY-MM-DD.',
  })
  @IsDateString({ strict: true })
  startDate!: string;

  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'End date must use YYYY-MM-DD.',
  })
  @IsDateString({ strict: true })
  endDate!: string;

  @Transform(trimText)
  @IsString()
  @MinLength(3)
  @MaxLength(2000)
  reason!: string;

  @IsOptional()
  @Transform(trimText)
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

/*
 * Patient submission:
 * one measurement session with any available readings.
 *
 * The service will require at least one measurement and
 * require systolic/diastolic BP together.
 */
export class SubmitRpmReadingDto {
  @IsDateString({ strict: true })
  measuredAt!: string;

  @ValidateIf((_object, value) => value !== undefined)
  @IsNumber({
    allowNaN: false,
    allowInfinity: false,
    maxDecimalPlaces: 3,
  })
  @Min(0.001)
  @Max(9999.999)
  weightKg?: number;

  @ValidateIf((_object, value) => value !== undefined)
  @IsNumber({
    allowNaN: false,
    allowInfinity: false,
    maxDecimalPlaces: 3,
  })
  @Min(-273.15)
  @Max(999.999)
  temperatureC?: number;

  @ValidateIf((_object, value) => value !== undefined)
  @IsInt()
  @Min(1)
  @Max(2147483647)
  systolicBp?: number;

  @ValidateIf((_object, value) => value !== undefined)
  @IsInt()
  @Min(1)
  @Max(2147483647)
  diastolicBp?: number;

  @ValidateIf((_object, value) => value !== undefined)
  @IsNumber({
    allowNaN: false,
    allowInfinity: false,
    maxDecimalPlaces: 3,
  })
  @Min(0)
  @Max(100)
  spo2Percent?: number;

  @ValidateIf((_object, value) => value !== undefined)
  @IsInt()
  @Min(1)
  @Max(2147483647)
  pulseBpm?: number;

  @ValidateIf((_object, value) => value !== undefined)
  @IsNumber({
    allowNaN: false,
    allowInfinity: false,
    maxDecimalPlaces: 3,
  })
  @Min(0.001)
  @Max(99999.999)
  bloodGlucoseMgDl?: number;

  @ValidateIf((_object, value) => value !== undefined)
  @IsIn(['FASTING', 'BEFORE_MEAL', 'AFTER_MEAL', 'RANDOM'])
  glucoseContext?: 'FASTING' | 'BEFORE_MEAL' | 'AFTER_MEAL' | 'RANDOM';

  @IsOptional()
  @Transform(trimText)
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

export class ListSimpleRpmDto {
  @Transform(queryInteger)
  @IsInt()
  @Min(1)
  page: number = 1;

  @Transform(queryInteger)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;

  @IsOptional()
  @Transform(trimText)
  @IsString()
  @MaxLength(100)
  search?: string;
}
