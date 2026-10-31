import { Type } from "class-transformer";

import {
  ArrayMaxSize,
  ArrayMinSize,
  Equals,
  IsArray,
  IsEnum,
  IsInt,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";

import { LabOrderPriority } from "../generated/prisma/enums.js";

export class LabOrderTestDto {
  @IsUUID()
  testId!: string;

  @IsInt()
  @Min(1)
  expectedVersion!: number;
}

export class CreateLabOrderDto {
  @IsInt()
  @Min(1)
  expectedEncounterVersion!: number;

  @IsEnum(LabOrderPriority)
  priority!: LabOrderPriority;

  @IsString()
  @Matches(/\S/, {
    message: "Enter a clinical reason for the tests.",
  })
  @MaxLength(2000)
  clinicalReason!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(30)
  @ValidateNested({ each: true })
  @Type(() => LabOrderTestDto)
  tests!: LabOrderTestDto[];

  @Equals(true)
  reviewConfirmed!: boolean;
}

export class ListLabOrdersDto {
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

export class CancelLabOrderDto {
  @IsInt()
  @Min(1)
  expectedVersion!: number;

  @IsString()
  @Matches(/\S/)
  @MaxLength(1000)
  reason!: string;
}
