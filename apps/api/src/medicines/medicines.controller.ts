import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
} from "@nestjs/common";

import { CurrentStaff } from "../auth/auth.decorators.js";
import { RequirePermissions } from "../auth/permissions.js";

import {
  CreateMedicineDto,
  ListMedicinesDto,
  SearchMedicinesDto,
  UpdateMedicineDto,
} from "./medicine.dto.js";

import { MedicinesService } from "./medicines.service.js";

@Controller("medicines")
export class MedicinesController {
  constructor(private readonly medicines: MedicinesService) {}

  @Get()
  @RequirePermissions("medicines.read")
  list(@Query() query: ListMedicinesDto) {
    return this.medicines.list(query);
  }

  @Get("search")
  @Header("Cache-Control", "no-store")
  @RequirePermissions("medicines.read")
  search(@Query() query: SearchMedicinesDto) {
    return this.medicines.search(query);
  }

  @Get(":id")
  @RequirePermissions("medicines.read")
  get(@Param("id", ParseUUIDPipe) id: string) {
    return this.medicines.get(id);
  }

  @Post()
  @RequirePermissions("medicines.manage")
  create(
    @Body() dto: CreateMedicineDto,
    @CurrentStaff() staff: { user: { id: string } },
  ) {
    return this.medicines.create(dto, staff.user.id);
  }

  @Put(":id")
  @RequirePermissions("medicines.manage")
  update(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateMedicineDto,
    @CurrentStaff() staff: { user: { id: string } },
  ) {
    return this.medicines.update(id, dto, staff.user.id);
  }
}
