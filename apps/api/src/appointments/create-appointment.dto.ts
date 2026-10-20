import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  Min,
} from 'class-validator';

import { AppointmentMode } from '../generated/prisma/enums.js';

export class CreateAppointmentDto {
  @IsUUID()
  patientId!: string;

  @IsUUID()
  doctorId!: string;

  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @IsDateString({ strict: true })
  date!: string;

  // Hospital local time, expressed as minutes after midnight.
  @IsInt()
  @Min(0)
  @Max(1439)
  startMinute!: number;

  @IsInt()
  @Min(1)
  expectedAvailabilityVersion!: number;

  @IsOptional()
  @IsEnum(AppointmentMode)
  mode: AppointmentMode = AppointmentMode.IN_PERSON;
}
