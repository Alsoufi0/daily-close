import { BadRequestException, Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CommissionStatus } from "@prisma/client";
import { SupabaseAuthGuard } from "../auth/supabase-auth.guard";
import { SuperAdminGuard } from "../auth/super-admin.guard";
import { CommissionsService } from "./commissions.service";
import { CreateAdjustmentDto } from "./dto/create-adjustment.dto";
import { UpdateCommissionStatusDto } from "./dto/update-commission-status.dto";

const STATUSES: CommissionStatus[] = ["PENDING", "APPROVED", "PAID", "REVERSED"];

@ApiTags("Commissions")
@ApiBearerAuth()
@Controller("commissions")
@UseGuards(SupabaseAuthGuard, SuperAdminGuard)
export class CommissionsController {
  constructor(private readonly commissions: CommissionsService) {}

  // Payouts queue. ?status=PENDING&period=2026-06&partnerId=...
  @Get()
  list(
    @Query("status") status?: string,
    @Query("period") period?: string,
    @Query("partnerId") partnerId?: string
  ) {
    return this.commissions.listForPayouts({
      status: this.parseStatus(status),
      period: period || undefined,
      partnerId: partnerId || undefined
    });
  }

  @Get("summary")
  summary(@Query("period") period?: string) {
    return this.commissions.summary(period || undefined);
  }

  @Post("adjustment")
  createAdjustment(@Body() dto: CreateAdjustmentDto) {
    return this.commissions.createAdjustment(dto);
  }

  @Patch(":id/status")
  updateStatus(@Param("id") id: string, @Body() dto: UpdateCommissionStatusDto) {
    return this.commissions.updateStatus(id, dto.status, dto.payoutReference);
  }

  private parseStatus(status?: string): CommissionStatus | undefined {
    if (!status) return undefined;
    if (!STATUSES.includes(status as CommissionStatus)) {
      throw new BadRequestException(`status must be one of ${STATUSES.join(", ")}.`);
    }
    return status as CommissionStatus;
  }
}
