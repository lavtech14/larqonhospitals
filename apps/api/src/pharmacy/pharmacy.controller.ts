import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Header,
  Headers,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from "@nestjs/common";
import { isUUID } from "class-validator";
import { CurrentStaff } from "../auth/auth.decorators.js";
import { RequirePermissions } from "../auth/permissions.js";
import {
  DispensePharmacyDto,
  PharmacyListDto,
  ReceivePharmacyStockDto,
} from "./pharmacy.dto.js";
import { PharmacyService } from "./pharmacy.service.js";
function requestKey(key: string | undefined) {
  if (!key || !isUUID(key))
    throw new BadRequestException("A UUID Idempotency-Key header is required.");
  return key;
}
@Controller("pharmacy")
export class PharmacyController {
  constructor(private readonly pharmacy: PharmacyService) {}
  @Header("Cache-Control", "no-store")
  @Get("stock")
  @RequirePermissions("pharmacy.stock.read")
  stock(@Query() query: PharmacyListDto) {
    return this.pharmacy.stock(query);
  }
  @Header("Cache-Control", "no-store")
  @Post("stock/receive")
  @RequirePermissions("pharmacy.stock.receive")
  receive(
    @CurrentStaff() staff: { user: { id: string } },
    @Headers("idempotency-key") key: string | undefined,
    @Body() dto: ReceivePharmacyStockDto,
  ) {
    return this.pharmacy.receive(staff.user.id, requestKey(key), dto);
  }
  @Header("Cache-Control", "no-store")
  @Get("prescriptions")
  @RequirePermissions("pharmacy.prescriptions.read")
  queue(@Query() query: PharmacyListDto) {
    return this.pharmacy.queue(query);
  }
  @Header("Cache-Control", "no-store")
  @Get("prescriptions/:id")
  @RequirePermissions("pharmacy.prescriptions.read")
  detail(@Param("id", ParseUUIDPipe) id: string) {
    return this.pharmacy.detail(id);
  }
  @Header("Cache-Control", "no-store")
  @Post("prescriptions/:id/dispense")
  @RequirePermissions("pharmacy.prescriptions.read", "pharmacy.dispense")
  dispense(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentStaff() staff: { user: { id: string } },
    @Headers("idempotency-key") key: string | undefined,
    @Body() dto: DispensePharmacyDto,
  ) {
    return this.pharmacy.dispense(id, staff.user.id, requestKey(key), dto);
  }
  @Header("Cache-Control", "no-store")
  @Get("dispenses")
  @RequirePermissions("pharmacy.prescriptions.read")
  history(@Query() query: PharmacyListDto) {
    return this.pharmacy.history(query);
  }
}
