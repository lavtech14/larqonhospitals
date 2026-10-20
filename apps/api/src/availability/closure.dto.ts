import {
  IsBoolean,
  IsDateString,
  IsInt,
  IsString,
  Matches,
  Min,
} from 'class-validator';

export class SaveClosureDto {
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @IsDateString({ strict: true })
  date!: string;

  @IsBoolean()
  isClosed!: boolean;

  @IsInt()
  @Min(0)
  expectedVersion!: number;
}

export class ListClosuresDto {
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @IsDateString({ strict: true })
  from!: string;

  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @IsDateString({ strict: true })
  to!: string;
}
