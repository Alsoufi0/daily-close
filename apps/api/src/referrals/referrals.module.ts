import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { AppSettingsService } from "./app-settings.service";
import { CommissionsController } from "./commissions.controller";
import { CommissionsService } from "./commissions.service";
import { PartnersController } from "./partners.controller";
import { PartnersService } from "./partners.service";
import { ReferralRewardsService } from "./referral-rewards.service";
import { ReferralSettingsController } from "./referral-settings.controller";
import { ReferralsMeController } from "./referrals-me.controller";
import { ReferralsPublicController } from "./referrals-public.controller";
import { ScanAlertService } from "./scan-alert.service";

// Referral attribution + recurring commission tracking (partner/distributor
// program) PLUS the owner→owner "refer a friend" credit program. Both
// CommissionsService and ReferralRewardsService are exported so the Stripe
// webhook (SubscriptionsModule) can mint/reverse rows from real payment events.
@Module({
  imports: [AuthModule],
  controllers: [
    PartnersController,
    CommissionsController,
    ReferralSettingsController,
    ReferralsPublicController,
    ReferralsMeController
  ],
  providers: [
    PartnersService,
    CommissionsService,
    ReferralRewardsService,
    AppSettingsService,
    ScanAlertService
  ],
  exports: [CommissionsService, ReferralRewardsService]
})
export class ReferralsModule {}
