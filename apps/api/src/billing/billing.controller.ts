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
  BillingListDto,
  CancelBillingDraftDto,
  CreateBillingInvoiceDto,
  IssueBillingInvoiceDto,
  RecordBillingPaymentDto,
  SaveBillingPriceDto,
} from "./billing.dto.js";
import { BillingService } from "./billing.service.js";
function key(value: string | undefined) {
  if (!value || !isUUID(value))
    throw new BadRequestException("A UUID Idempotency-Key header is required.");
  return value;
}
@Controller("billing")
export class BillingController {
  constructor(private readonly billing: BillingService) {}
  @Get("patients")
  @Header("Cache-Control", "no-store")
  @RequirePermissions("billing.read")
  patients(@Query() q: BillingListDto) {
    return this.billing.patients(q);
  }
  @Get("catalogue")
  @Header("Cache-Control", "no-store")
  @RequirePermissions("billing.prices.manage")
  catalogue(@Query() q: BillingListDto) {
    return this.billing.catalogue(q);
  }
  @Get("prices")
  @Header("Cache-Control", "no-store")
  @RequirePermissions("billing.read")
  prices(@Query() q: BillingListDto) {
    return this.billing.prices(q);
  }
  @Post("prices")
  @Header("Cache-Control", "no-store")
  @RequirePermissions("billing.prices.manage")
  createPrice(
    @CurrentStaff() s: { user: { id: string } },
    @Headers("idempotency-key") k: string | undefined,
    @Body() dto: SaveBillingPriceDto,
  ) {
    return this.billing.savePrice(undefined, s.user.id, key(k), dto);
  }
  @Post("prices/:id/update")
  @Header("Cache-Control", "no-store")
  @RequirePermissions("billing.prices.manage")
  updatePrice(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentStaff() s: { user: { id: string } },
    @Headers("idempotency-key") k: string | undefined,
    @Body() dto: SaveBillingPriceDto,
  ) {
    return this.billing.savePrice(id, s.user.id, key(k), dto);
  }
  @Get("patients/:id/charges")
  @Header("Cache-Control", "no-store")
  @RequirePermissions("billing.read")
  charges(@Param("id", ParseUUIDPipe) id: string, @Query() q: BillingListDto) {
    return this.billing.charges(id, q);
  }
  @Get("invoices")
  @Header("Cache-Control", "no-store")
  @RequirePermissions("billing.read")
  list(@Query() q: BillingListDto) {
    return this.billing.list(q);
  }
  @Get("invoices/:id")
  @Header("Cache-Control", "no-store")
  @RequirePermissions("billing.read")
  detail(@Param("id", ParseUUIDPipe) id: string) {
    return this.billing.detail(id);
  }
  @Post("invoices")
  @Header("Cache-Control", "no-store")
  @RequirePermissions("billing.invoices.manage")
  create(
    @CurrentStaff() s: { user: { id: string } },
    @Headers("idempotency-key") k: string | undefined,
    @Body() dto: CreateBillingInvoiceDto,
  ) {
    return this.billing.create(s.user.id, key(k), dto);
  }
  @Post("invoices/:id/issue")
  @Header("Cache-Control", "no-store")
  @RequirePermissions("billing.invoices.manage")
  issue(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentStaff() s: { user: { id: string } },
    @Headers("idempotency-key") k: string | undefined,
    @Body() dto: IssueBillingInvoiceDto,
  ) {
    return this.billing.issue(id, s.user.id, key(k), dto);
  }
  @Post("invoices/:id/cancel")
  @Header("Cache-Control", "no-store")
  @RequirePermissions("billing.invoices.manage")
  cancel(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentStaff() s: { user: { id: string } },
    @Headers("idempotency-key") k: string | undefined,
    @Body() dto: CancelBillingDraftDto,
  ) {
    return this.billing.cancel(id, s.user.id, key(k), dto);
  }
  @Post("invoices/:id/payments")
  @Header("Cache-Control", "no-store")
  @RequirePermissions("billing.payments.record")
  pay(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentStaff() s: { user: { id: string } },
    @Headers("idempotency-key") k: string | undefined,
    @Body() dto: RecordBillingPaymentDto,
  ) {
    return this.billing.pay(id, s.user.id, key(k), dto);
  }
}
