import { Type } from 'class-transformer';
import { IsInt, IsString, Max, MaxLength, Min } from 'class-validator';

export class EncounterVersionDto {
  @IsInt()
  @Min(1)
  expectedVersion!: number;
}

export class SaveClinicalNotesDto extends EncounterVersionDto {
  @IsString()
  @MaxLength(5000)
  complaint!: string;

  @IsString()
  @MaxLength(5000)
  history!: string;

  @IsString()
  @MaxLength(5000)
  examination!: string;

  @IsString()
  @MaxLength(5000)
  assessment!: string;

  @IsString()
  @MaxLength(5000)
  plan!: string;
}

export class DoctorEncounterQueryDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10000)
  vitalsPage = 1;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10000)
  notesPage = 1;
}
