import {
  Equals,
  IsInt,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';

export class PublishVisitSummaryDto {
  @IsInt()
  @Min(1)
  expectedVersion!: number;

  @IsUUID()
  sourceNoteRevisionId!: string;

  @IsString()
  @Matches(/\S/, {
    message: 'Enter a patient-facing visit summary.',
  })
  @MaxLength(5000)
  summary!: string;

  @IsString()
  @Matches(/\S/, {
    message: 'Enter the patient care plan.',
  })
  @MaxLength(5000)
  carePlan!: string;

  @IsString()
  @MaxLength(2000)
  followUp!: string;

  @IsString()
  @MaxLength(2000)
  returnPrecautions!: string;

  @Equals(true, {
    message: 'Confirm that you reviewed the summary.',
  })
  reviewConfirmed!: boolean;
}
