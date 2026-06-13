import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { ReferralsModule } from "../referrals/referrals.module";
import { SubscriptionsController } from "./subscriptions.controller";
import { SubscriptionsService } from "./subscriptions.service";
import { SubscriptionGuard } from "./subscription.guard";

@Module({
  // ReferralsModule exports CommissionsService so the Stripe webhook can mint /
  // reverse commission rows from real payment events.
  imports: [AuthModule, ReferralsModule],
  controllers: [SubscriptionsController],
  providers: [SubscriptionsService, SubscriptionGuard],
  exports: [SubscriptionsService, SubscriptionGuard]
})
export class SubscriptionsModule {}
