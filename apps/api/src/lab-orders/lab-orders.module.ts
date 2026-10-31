import { Module } from '@nestjs/common';

import { DatabaseModule } from '../database/database.module.js';
import { LabOrdersController } from './lab-orders.controller.js';
import { LabOrdersService } from './lab-orders.service.js';

@Module({
  imports: [DatabaseModule],
  controllers: [LabOrdersController],
  providers: [LabOrdersService],
})
export class LabOrdersModule {}
