import { Equals, IsInt, IsUUID, Min } from 'class-validator';

export class ReleaseLabReportDto {
  @IsInt()
  @Min(1)
  expectedVersion!: number;

  @IsUUID()
  sourceRevisionId!: string;

  @Equals(true, {
    message: 'Confirm review before releasing the report.',
  })
  reviewConfirmed!: boolean;
}
