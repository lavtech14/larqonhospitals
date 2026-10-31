import { Module } from '@nestjs/common';

import { DatabaseModule } from '../database/database.module.js';
import { MedicinesController } from './medicines.controller.js';
import { MedicinesService } from './medicines.service.js';

@Module({
  imports: [DatabaseModule],
  controllers: [MedicinesController],
  providers: [MedicinesService],
})
export class MedicinesModule {}
