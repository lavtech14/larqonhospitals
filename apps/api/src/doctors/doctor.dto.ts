import { Transform, Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  IsBoolean,
  IsDefined,
  ValidateIf,
} from 'class-validator';
import { PartialType } from '@nestjs/mapped-types';

function trimText({ value }: { value: unknown }) {
  return typeof value === 'string' ? value.trim() : value;
}

export class CreateDoctorDto {
  @Transform(trimText)
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  displayName!: string;

  @Transform(trimText)
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  specialty!: string;

  @Transform(trimText)
  @IsOptional()
  @IsString()
  @MaxLength(200)
  qualification?: string;

  @Transform(trimText)
  @IsOptional()
  @IsString()
  @MaxLength(100)
  registrationNumber?: string;

  @Transform(trimText)
  @IsOptional()
  @IsString()
  @MaxLength(100)
  registrationAuthority?: string;

  @IsUUID('4')
  departmentId!: string;

  @IsOptional()
  @IsUUID('4')
  staffUserId?: string;
}

export class ListDoctorsDto {
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

  @IsOptional()
  @IsUUID('4')
  departmentId?: string;
}

export class UpdateDoctorDto extends PartialType(CreateDoctorDto, {
  skipNullProperties: false,
}) {
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsBoolean()
  isActive?: boolean;

  @IsDefined()
  @IsInt()
  @Min(1)
  expectedVersion!: number;
}
