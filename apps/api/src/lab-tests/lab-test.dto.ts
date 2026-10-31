import { OmitType } from "@nestjs/mapped-types";
import { Type } from "class-transformer";

import {
  IsBoolean,
  IsArray,
  ArrayMaxSize,
  ValidateNested,
  IsIn,
  IsInt,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from "class-validator";

export class LabParameterDto {
  @IsString()
  @Matches(/^[A-Za-z0-9_-]{1,40}$/)
  code!: string;
  @IsString()
  @MaxLength(100)
  @Matches(/\S/)
  name!: string;
  @IsIn(["NUMERIC", "TEXT"])
  kind!: "NUMERIC" | "TEXT";
  @IsString()
  @MaxLength(50)
  unit!: string;
  @IsString()
  @MaxLength(500)
  referenceText!: string;
  @IsBoolean()
  required!: boolean;
}

export class CreateLabTestDto {
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => LabParameterDto)
  parameters: LabParameterDto[] = [];

  @IsString()
  @MaxLength(40)
  @Matches(/^[A-Za-z0-9_-]{1,40}$/, {
    message:
      "Code must contain only letters, numbers, hyphens, or underscores.",
  })
  code!: string;

  @IsString()
  @MaxLength(200)
  @Matches(/\S/, {
    message: "Enter the test name.",
  })
  displayName!: string;

  @IsString()
  @MaxLength(100)
  @Matches(/\S/, {
    message: "Enter the sample type.",
  })
  sampleType!: string;

  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @MaxLength(2000)
  preparationInstructions?: string;
}

export class UpdateLabTestDto extends OmitType(CreateLabTestDto, [
  "parameters",
] as const) {
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => LabParameterDto)
  parameters!: LabParameterDto[];

  @IsInt()
  @Min(1)
  expectedVersion!: number;

  @IsBoolean()
  isActive!: boolean;
}

export class ListLabTestsDto {
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
  @MaxLength(200)
  search?: string;

  @IsIn(["true", "false", "all"])
  active: "true" | "false" | "all" = "true";
}
