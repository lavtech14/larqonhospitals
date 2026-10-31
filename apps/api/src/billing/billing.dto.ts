import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  Equals,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";
import {
  BillingKind,
  BillingPaymentMethod,
} from "../generated/prisma/enums.js";
export class BillingListDto {
  @Type(() => Number) @IsInt() @Min(1) @Max(100000) page = 1;
  @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 20;
  @IsOptional() @IsString() @MaxLength(100) search?: string;
  @IsOptional() @IsEnum(BillingKind) kind?: BillingKind;
}
export class SaveBillingPriceDto {
  @IsEnum(BillingKind) kind!: BillingKind;
  @IsUUID() entityId!: string;
  @IsString() @Matches(/\S/) @MaxLength(50) quantityUnit!: string;
  @Matches(/^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/) unitPrice!: string;
  @IsBoolean() isActive!: boolean;
  @IsOptional() @IsInt() @Min(1) expectedVersion?: number;
}
export class BillingSelectionDto {
  @IsEnum(BillingKind) kind!: BillingKind;
  @IsUUID() sourceId!: string;
  @IsUUID() priceId!: string;
  @IsInt() @Min(1) expectedPriceVersion!: number;
}
export class CreateBillingInvoiceDto {
  @IsUUID() patientId!: string;
  @IsOptional() @IsString() @MaxLength(1000) notes?: string;
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => BillingSelectionDto)
  lines!: BillingSelectionDto[];
}
export class BillingVersionDto {
  @IsInt() @Min(1) expectedVersion!: number;
}
export class IssueBillingInvoiceDto extends BillingVersionDto {
  @Equals(true) reviewConfirmed!: boolean;
}
export class CancelBillingDraftDto extends BillingVersionDto {
  @IsString() @Matches(/\S/) @MaxLength(1000) reason!: string;
}
export class RecordBillingPaymentDto extends BillingVersionDto {
  @IsEnum(BillingPaymentMethod) method!: BillingPaymentMethod;
  @Matches(/^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/) amount!: string;
  @IsOptional() @IsString() @MaxLength(100) externalReference?: string;
  @IsOptional() @IsString() @MaxLength(1000) notes?: string;
  @Equals(true) receiptConfirmed!: boolean;
}
