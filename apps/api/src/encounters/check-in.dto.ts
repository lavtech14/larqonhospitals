import { IsInt, Min } from "class-validator";

export class CheckInDto {
  @IsInt()
  @Min(1)
  expectedVersion!: number;
}
