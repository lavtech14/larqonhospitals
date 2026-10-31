import { Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, IsUUID, Max, Min } from "class-validator";

export class ListNursingQueueDto {
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
  @IsUUID()
  doctorId?: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @IsOptional()
  @IsIn(["CHECKED_IN", "READY_FOR_DOCTOR"])
  status?: "CHECKED_IN" | "READY_FOR_DOCTOR";
}
