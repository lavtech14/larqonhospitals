import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsEmail,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

import { StaffRole } from '../generated/prisma/enums.js';

function trimText({ value }: { value: unknown }) {
  return typeof value === 'string' ? value.trim() : value;
}

export class CreateStaffDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @Transform(trimText)
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  fullName!: string;

  // Do not trim passwords.
  @IsString()
  @MinLength(15)
  @MaxLength(128)
  temporaryPassword!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(8)
  @ArrayUnique()
  @IsEnum(StaffRole, { each: true })
  roles!: StaffRole[];

  @Transform(trimText)
  @IsOptional()
  @IsString()
  @MaxLength(200)
  addressLine1?: string;

  @Transform(trimText)
  @IsOptional()
  @IsString()
  @MaxLength(200)
  addressLine2?: string;

  @Transform(trimText)
  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;

  @Transform(trimText)
  @IsOptional()
  @IsString()
  @MaxLength(100)
  district?: string;

  @Transform(trimText)
  @IsOptional()
  @IsString()
  @MaxLength(100)
  state?: string;

  @Transform(trimText)
  @IsOptional()
  @IsString()
  @MaxLength(20)
  postalCode?: string;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsOptional()
  @Matches(/^[A-Z]{2}$/)
  countryCode?: string;
}

export class ListStaffDto {
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

  @Transform(trimText)
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @IsEnum(StaffRole)
  role?: StaffRole;

  @IsOptional()
  @IsIn(['active', 'inactive'])
  status?: 'active' | 'inactive';
}
