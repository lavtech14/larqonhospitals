import { Type } from 'class-transformer';

import {
  Equals,
  IsInt,
  IsISO8601,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

export class LabQueueDto {
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

  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @MaxLength(100)
  search?: string;
}

export class CollectLabSampleDto {
  @IsInt()
  @Min(1)
  expectedOrderVersion!: number;

  @IsString()
  @Matches(/^[A-Za-z0-9][A-Za-z0-9_-]{0,49}$/, {
    message:
      'Specimen reference must contain 1–50 letters, numbers, hyphens, or underscores.',
  })
  specimenReference!: string;

  @IsISO8601({ strict: true })
  @Matches(/(?:Z|[+-]\d{2}:\d{2})$/, {
    message: 'Collection time must include a timezone.',
  })
  collectedAt!: string;

  @Equals(true)
  collectionConfirmed!: boolean;
}
export class RejectLabSampleDto {
  @IsInt()
  @Min(1)
  expectedSampleVersion!: number;

  @IsInt()
  @Min(1)
  expectedOrderVersion!: number;

  @IsString()
  @Matches(/\S/, {
    message: 'Enter the specimen rejection reason.',
  })
  @MaxLength(1000)
  reason!: string;

  @Equals(true)
  rejectionConfirmed!: boolean;
}
