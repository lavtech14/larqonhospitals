import { PickType } from '@nestjs/mapped-types';
import { ListAppointmentsDto } from './list-appointments.dto.js';

export class ListOwnAppointmentsDto extends PickType(ListAppointmentsDto, [
  'from',
  'to',
  'status',
  'page',
  'limit',
] as const) {}
