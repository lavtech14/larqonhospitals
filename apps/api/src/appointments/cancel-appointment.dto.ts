import { IsInt, Min } from 'class-validator';

export class CancelAppointmentDto {
  @IsInt()
  @Min(1)
  expectedVersion!: number;
}
