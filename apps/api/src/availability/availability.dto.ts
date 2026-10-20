import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsObject,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class TimeRangeDto {
  @IsInt()
  @Min(0)
  @Max(1439)
  startMinute!: number;

  @IsInt()
  @Min(1)
  @Max(1440)
  endMinute!: number;
}

export class AvailabilityWindowDto extends TimeRangeDto {
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek!: number;

  @IsInt()
  @Min(5)
  @Max(120)
  slotMinutes!: number;

  @IsArray()
  @ArrayMaxSize(8)
  @IsObject({ each: true })
  @ValidateNested({ each: true })
  @Type(() => TimeRangeDto)
  breaks: TimeRangeDto[] = [];
}

export class SaveAvailabilityDto {
  @IsInt()
  @Min(0)
  expectedVersion!: number;

  @IsArray()
  @ArrayMaxSize(28)
  @IsObject({ each: true })
  @ValidateNested({ each: true })
  @Type(() => AvailabilityWindowDto)
  windows!: AvailabilityWindowDto[];
}
