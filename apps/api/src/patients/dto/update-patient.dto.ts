import { OmitType, PartialType } from '@nestjs/mapped-types';
import { IsDefined, IsInt, Min } from 'class-validator';
import { CreatePatientDto } from './create-patient.dto.js';

class EditablePatientDto extends OmitType(CreatePatientDto, [
  'duplicateReviewConfirmed',
] as const) {}

export class UpdatePatientDto extends PartialType(EditablePatientDto, {
  skipNullProperties: false,
}) {
  @IsDefined()
  @IsInt()
  @Min(1)
  expectedVersion!: number;
}
