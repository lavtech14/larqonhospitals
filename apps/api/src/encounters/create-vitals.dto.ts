import {
  IsInt,
  IsISO8601,
  IsNumber,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

export class CreateVitalsDto {
  @IsInt()
  @Min(1)
  expectedVersion!: number;

  @IsISO8601({ strict: true, strictSeparator: true })
  @Matches(/T.*(?:Z|[+-]\d{2}:\d{2})$/, {
    message: 'measuredAt must include a timezone.',
  })
  measuredAt!: string;

  @ValidateIf((_object, value) => value !== undefined)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(999.99)
  temperatureC?: number;

  @ValidateIf((_object, value) => value !== undefined)
  @IsInt()
  @Min(0)
  @Max(2147483647)
  pulseBpm?: number;

  @ValidateIf((_object, value) => value !== undefined)
  @IsInt()
  @Min(0)
  @Max(2147483647)
  respiratoryRate?: number;

  @ValidateIf((_object, value) => value !== undefined)
  @IsInt()
  @Min(0)
  @Max(2147483647)
  systolicBp?: number;

  @ValidateIf((_object, value) => value !== undefined)
  @IsInt()
  @Min(0)
  @Max(2147483647)
  diastolicBp?: number;

  @ValidateIf((_object, value) => value !== undefined)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  oxygenSaturation?: number;

  @ValidateIf((_object, value) => value !== undefined)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(9999.99)
  weightKg?: number;

  @ValidateIf((_object, value) => value !== undefined)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(9999.99)
  heightCm?: number;

  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
