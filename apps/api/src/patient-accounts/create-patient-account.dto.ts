import { Transform } from 'class-transformer';
import {
  Equals,
  IsBoolean,
  IsEmail,
  IsInt,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreatePatientAccountDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @IsString()
  @MinLength(16)
  @MaxLength(128)
  temporaryPassword!: string;

  @IsInt()
  @Min(1)
  expectedPatientVersion!: number;

  @IsBoolean()
  @Equals(true)
  identityConfirmed!: boolean;
}
