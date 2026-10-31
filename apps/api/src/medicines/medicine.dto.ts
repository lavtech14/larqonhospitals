import { Transform, Type } from "class-transformer";
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";

export class CreateMedicineDto {
  @IsString()
  @Matches(/^[A-Za-z0-9][A-Za-z0-9_-]{0,39}$/, {
    message: "Code must contain 1–40 letters, numbers, underscores or hyphens.",
  })
  code!: string;

  @IsString()
  @MaxLength(200)
  @Matches(/\S/, { message: "Medicine name is required." })
  displayName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  genericName?: string;

  @IsString()
  @MaxLength(100)
  @Matches(/\S/, { message: "Strength is required." })
  strength!: string;

  @IsString()
  @MaxLength(100)
  @Matches(/\S/, { message: "Dosage form is required." })
  dosageForm!: string;
}

export class UpdateMedicineDto extends CreateMedicineDto {
  @IsInt()
  @Min(1)
  expectedVersion!: number;

  @IsBoolean()
  isActive!: boolean;
}

export class ListMedicinesDto {
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

  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @IsIn(["true", "false", "all"])
  active: "true" | "false" | "all" = "true";
}

export class SearchMedicinesDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === "string" ? value.trim() : value,
  )
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  search!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  limit = 12;
}
