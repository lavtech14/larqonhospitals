import { Transform, Type } from 'class-transformer';
import {
  IsInt,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  IsBoolean,
  IsDefined,
  ValidateIf,
} from 'class-validator';
import { PartialType, PickType } from '@nestjs/mapped-types';

export class CreateDepartmentDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsString()
  @MinLength(2)
  @MaxLength(20)
  @Matches(/^[A-Z][A-Z0-9_-]*$/, {
    message:
      'code must start with a letter and contain only letters, digits, underscores or hyphens',
  })
  code!: string;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name!: string;
}

export class ListDepartmentsDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  page: number = 1;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;
}

export class UpdateDepartmentDto extends PartialType(
  PickType(CreateDepartmentDto, ['name'] as const),
  { skipNullProperties: false },
) {
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsBoolean()
  isActive?: boolean;

  @IsDefined()
  @IsInt()
  @Min(1)
  expectedVersion!: number;
}
