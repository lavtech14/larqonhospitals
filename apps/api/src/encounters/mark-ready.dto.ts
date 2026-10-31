import { IsInt, Min } from 'class-validator';

export class MarkReadyDto {
  @IsInt()
  @Min(1)
  expectedVersion!: number;
}
