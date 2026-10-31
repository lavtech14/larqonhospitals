import { Module } from '@nestjs/common';

import { DatabaseModule } from '../database/database.module.js';

import { EncountersController } from './encounters.controller.js';
import { EncountersService } from './encounters.service.js';
import { VitalsController } from './vitals.controller.js';
import { VitalsService } from './vitals.service.js';

import { DoctorEncountersController } from './doctor-encounters.controller.js';
import { DoctorEncountersService } from './doctor-encounters.service.js';
import { VisitSummariesController } from './visit-summaries.controller.js';
import { VisitSummariesService } from './visit-summaries.service.js';

@Module({
  imports: [DatabaseModule],
  controllers: [
    EncountersController,
    VitalsController,
    DoctorEncountersController,
    VisitSummariesController,
  ],
  providers: [
    EncountersService,
    VitalsService,
    DoctorEncountersService,
    VisitSummariesService,
  ],
})
export class EncountersModule {}
