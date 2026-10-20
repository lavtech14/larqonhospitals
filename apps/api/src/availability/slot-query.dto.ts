import { IsDateString, IsString, Matches } from 'class-validator';

export class SlotQueryDto {
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @IsDateString({ strict: true })
  date!: string;
}
