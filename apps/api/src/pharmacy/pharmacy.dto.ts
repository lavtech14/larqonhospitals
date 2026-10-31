import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  Equals,
  IsArray,
  IsIn,
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
export class PharmacyListDto {
  @Type(() => Number) @IsInt() @Min(1) @Max(100000) page = 1;
  @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 20;
  @IsOptional() @IsString() @MaxLength(100) search?: string;
  @IsOptional() @IsUUID() medicineId?: string;
  @IsIn(["pending", "all"]) scope: "pending" | "all" = "pending";
}
export class ReceivePharmacyStockDto {
  @IsUUID() medicineId!: string;
  @IsString() @Matches(/\S/) @MaxLength(100) batchNumber!: string;
  @Matches(/^\d{4}-\d{2}-\d{2}$/) expiryDate!: string;
  @Matches(/^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/) receivedQuantity!: string;
  @IsString() @Matches(/\S/) @MaxLength(50) quantityUnit!: string;
  @IsOptional() @IsString() @MaxLength(200) supplierName?: string;
  @IsOptional() @IsString() @MaxLength(100) reference?: string;
}
export class PharmacyAllocationDto {
  @IsUUID() prescriptionItemId!: string;
  @IsUUID() stockLotId!: string;
  @Matches(/^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/) quantity!: string;
}
export class DispensePharmacyDto {
  @IsInt() @Min(1) expectedPrescriptionVersion!: number;
  @Equals(true, {
    message: "Confirm patient identity and prescription review.",
  })
  patientAndPrescriptionConfirmed!: boolean;
  @IsOptional() @IsString() @MaxLength(1000) notes?: string;
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => PharmacyAllocationDto)
  allocations!: PharmacyAllocationDto[];
}
