import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Header,
  Headers,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from "@nestjs/common";

import { isUUID } from "class-validator";

import { CurrentStaff } from "../auth/auth.decorators.js";
import { RequirePermissions } from "../auth/permissions.js";

import {
  CreateLabOrderDto,
  ListLabOrdersDto,
  CancelLabOrderDto,
} from "./lab-order.dto.js";

import { LabOrdersService } from "./lab-orders.service.js";

@Controller("doctor/appointments/:appointmentId/lab-orders")
export class LabOrdersController {
  constructor(private readonly orders: LabOrdersService) {}

  @Get()
  @Header("Cache-Control", "no-store")
  @RequirePermissions("lab-orders.own.read")
  list(
    @Param("appointmentId", ParseUUIDPipe)
    appointmentId: string,

    @CurrentStaff()
    staff: { user: { id: string } },

    @Query()
    query: ListLabOrdersDto,
  ) {
    return this.orders.list(appointmentId, staff.user.id, query);
  }

  @Post()
  @HttpCode(200)
  @RequirePermissions(
    "lab-orders.own.read",
    "lab-orders.own.create",
    "lab-tests.read",
  )
  create(
    @Param("appointmentId", ParseUUIDPipe)
    appointmentId: string,

    @CurrentStaff()
    staff: { user: { id: string } },

    @Body()
    dto: CreateLabOrderDto,

    @Headers("idempotency-key")
    key: string | undefined,
  ) {
    if (typeof key !== "string" || !isUUID(key)) {
      throw new BadRequestException(
        "A UUID Idempotency-Key header is required.",
      );
    }

    return this.orders.create(appointmentId, staff.user.id, key, dto);
  }
  @Post(":orderId/cancel")
  @HttpCode(200)
  @RequirePermissions("lab-orders.own.read", "lab-orders.own.cancel")
  cancel(
    @Param("appointmentId", ParseUUIDPipe) appointmentId: string,
    @Param("orderId", ParseUUIDPipe) orderId: string,
    @CurrentStaff() staff: { user: { id: string } },
    @Body() dto: CancelLabOrderDto,
    @Headers("idempotency-key") key: string | undefined,
  ) {
    if (typeof key !== "string" || !isUUID(key))
      throw new BadRequestException(
        "A UUID Idempotency-Key header is required.",
      );
    return this.orders.cancel(appointmentId, orderId, staff.user.id, key, dto);
  }
}
