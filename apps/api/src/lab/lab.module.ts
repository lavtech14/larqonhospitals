import { Module } from '@nestjs/common';

import { DatabaseModule } from '../database/database.module.js';

import { LabController } from './lab.controller.js';
import { LabService } from './lab.service.js';

import { LabResultsController } from './lab-results.controller.js';
import { LabResultsService } from './lab-results.service.js';

import { LabReportsController } from './lab-reports.controller.js';
import { LabReportsService } from './lab-reports.service.js';
import { LabSpecimensController } from './lab-specimens.controller.js';
import { LabSpecimensService } from './lab-specimens.service.js';

@Module({
  imports: [DatabaseModule],

  controllers: [
    LabController,
    LabResultsController,
    LabReportsController,
    LabSpecimensController,
  ],

  providers: [
    LabService,
    LabResultsService,
    LabReportsService,
    LabSpecimensService,
  ],
})
export class LabModule {}
