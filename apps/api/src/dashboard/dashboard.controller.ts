import { Controller, ForbiddenException, Get, Param, ParseIntPipe, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../auth/current-user.decorator";
import { RequestUser } from "../auth/request-user";
import { SupabaseAuthGuard } from "../auth/supabase-auth.guard";
import { SubscriptionGuard } from "../subscriptions/subscription.guard";
import { DashboardService } from "./dashboard.service";

@ApiTags("Dashboard")
@ApiBearerAuth()
@Controller("dashboard")
@UseGuards(SupabaseAuthGuard, SubscriptionGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get("owner/:ownerId/today")
  getOwnerToday(@Param("ownerId") ownerId: string, @CurrentUser() user: RequestUser) {
    if (user.role !== "STORE_OWNER" || user.ownerId !== ownerId) {
      throw new ForbiddenException("Cannot view another owner's stores.");
    }
    return this.dashboardService.getOwnerToday(ownerId);
  }

  @Get("me/today")
  getMyToday(@CurrentUser() user: RequestUser) {
    return this.dashboardService.getMyToday(user);
  }

  @Get("me/history")
  getMyHistory(
    @CurrentUser() user: RequestUser,
    @Query("days", new ParseIntPipe({ optional: true })) days?: number
  ) {
    return this.dashboardService.getHistory(user, Math.min(Math.max(days ?? 7, 1), 31));
  }
}
