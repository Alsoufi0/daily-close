import { Module } from "@nestjs/common";
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

@Module({
  imports: [
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
    EmployeesModule
  ]
})
export class AppModule {}
