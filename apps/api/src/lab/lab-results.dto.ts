import { Type } from "class-transformer";

import {
  IsIn,
  IsArray,
  ArrayMaxSize,
  ValidateNested,
  IsInt,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from "class-validator";

export class LabResultsPageDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10000)
  page = 1;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 10;
}

export class LabResultsQueueDto extends LabResultsPageDto {
  @IsIn(["pending", "drafted", "all"])
  state: "pending" | "drafted" | "all" = "pending";

  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @MaxLength(100)
  search?: string;
}

export class LabResultValueDto {
  @IsString()
  @MaxLength(40)
  @Matches(/^[A-Za-z0-9_-]+$/)
  code!: string;
  @IsString()
  @MaxLength(1000)
  value!: string;
  @IsIn(["NOT_FLAGGED", "NORMAL", "LOW", "HIGH", "ABNORMAL"])
  flag!: "NOT_FLAGGED" | "NORMAL" | "LOW" | "HIGH" | "ABNORMAL";
}

export class SaveLabResultDto {
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => LabResultValueDto)
  values: LabResultValueDto[] = [];

  @IsInt()
  @Min(1)
  expectedVersion!: number;

  @IsString()
  @MaxLength(200)
  method!: string;

  @IsString()
  @MaxLength(10000)
  resultText!: string;

  @IsString()
  @MaxLength(2000)
  comments!: string;
}
