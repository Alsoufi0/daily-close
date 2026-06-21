import { Controller, ForbiddenException, Get, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../auth/current-user.decorator";
import { RequestUser } from "../auth/request-user";
import { SupabaseAuthGuard } from "../auth/supabase-auth.guard";
import { ReferralRewardsService } from "./referral-rewards.service";

// Owner-facing "refer a friend" surface (distinct from the admin partner
// console). Authenticated; returns the signed-in owner's own referral code +
// the credit they've earned, for the billing page card.
@ApiTags("Referrals")
@ApiBearerAuth()
@Controller("referrals")
@UseGuards(SupabaseAuthGuard)
export class ReferralsMeController {
  constructor(private readonly rewards: ReferralRewardsService) {}

  @Get("me")
  me(@CurrentUser() user: RequestUser) {
    if (!user.ownerId) {
      // Only account owners have a referral code / can earn credit.
      throw new ForbiddenException("Only account owners have a referral link.");
    }
    return this.rewards.summaryForOwner(user.ownerId);
  }
}
