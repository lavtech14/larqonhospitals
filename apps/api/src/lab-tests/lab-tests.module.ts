import { Module } from '@nestjs/common';

import { DatabaseModule } from '../database/database.module.js';

import { LabTestsController } from './lab-tests.controller.js';
import { LabTestsService } from './lab-tests.service.js';

@Module({
  imports: [DatabaseModule],

  controllers: [LabTestsController],

  providers: [LabTestsService],
})
export class LabTestsModule {}
