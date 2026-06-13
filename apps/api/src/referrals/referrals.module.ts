import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { AppSettingsService } from "./app-settings.service";
import { CommissionsController } from "./commissions.controller";
import { CommissionsService } from "./commissions.service";
import { PartnersController } from "./partners.controller";
import { PartnersService } from "./partners.service";
import { ReferralSettingsController } from "./referral-settings.controller";
import { ReferralsPublicController } from "./referrals-public.controller";
import { ScanAlertService } from "./scan-alert.service";

// Referral attribution + recurring commission tracking. CommissionsService is
// exported so the Stripe webhook (SubscriptionsModule) can mint/reverse rows
// from real payment events.
@Module({
  imports: [AuthModule],
  controllers: [
    PartnersController,
    CommissionsController,
    ReferralSettingsController,
    ReferralsPublicController
  ],
  providers: [PartnersService, CommissionsService, AppSettingsService, ScanAlertService],
  exports: [CommissionsService]
})
export class ReferralsModule {}
