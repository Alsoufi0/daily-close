import { MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { OriginCheckMiddleware } from "./common/origin-check.middleware";
import { AuthModule } from "./auth/auth.module";
import { DailyCloseModule } from "./daily-close/daily-close.module";
import { DashboardModule } from "./dashboard/dashboard.module";
import { NotificationsModule } from "./notifications/notifications.module";
import { OcrModule } from "./ocr/ocr.module";
import { PosParsersModule } from "./pos-parsers/pos-parsers.module";
import { PrismaModule } from "./prisma/prisma.module";
import { ReportsModule } from "./reports/reports.module";
import { SupabaseModule } from "./supabase/supabase.module";
import { StoresModule } from "./stores/stores.module";
import { HealthModule } from "./health/health.module";
import { SubscriptionsModule } from "./subscriptions/subscriptions.module";
import { EmployeesModule } from "./employees/employees.module";
import { ReferralsModule } from "./referrals/referrals.module";

@Module({
  imports: [
    // Global rate-limit baseline (audit fix #5 / quick-wins bundle). A
    // permissive default — 120 requests per IP per minute — protects against
    // accidental loops and casual abuse without breaking normal dashboard
    // polling. Auth endpoints layer a tighter per-route @Throttle() on top.
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    PrismaModule,
    AuthModule,
    OcrModule,
    PosParsersModule,
    DailyCloseModule,
    DashboardModule,
    NotificationsModule,
    ReportsModule,
    SupabaseModule,
    StoresModule,
    HealthModule,
    SubscriptionsModule,
    EmployeesModule,
    ReferralsModule
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }]
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // Origin-check CSRF defense-in-depth on every route. The middleware
    // itself skips safe methods, cron paths, and Stripe webhooks (which
    // carry their own auth). See OriginCheckMiddleware for details.
    consumer.apply(OriginCheckMiddleware).forRoutes("*");
  }
}
