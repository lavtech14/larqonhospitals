import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module.js';
import { AvailabilityController } from './availability.controller.js';
import { AvailabilityService } from './availability.service.js';
import {
  DoctorClosureController,
  HospitalClosureController,
} from './closure.controller.js';
import { ClosureService } from './closure.service.js';
import { SlotsController } from './slots.controller.js';
import { SlotsService } from './slots.service.js';

@Module({
  imports: [DatabaseModule],
  controllers: [
    AvailabilityController,
    DoctorClosureController,
    HospitalClosureController,
    SlotsController,
  ],
  providers: [AvailabilityService, ClosureService, SlotsService],
})
export class AvailabilityModule {}
