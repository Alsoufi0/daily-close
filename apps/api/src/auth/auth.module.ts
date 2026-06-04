import { Module } from "@nestjs/common";
import { AuthController } from "./auth.controller";
import { SupabaseAuthGuard } from "./supabase-auth.guard";
import { SupabaseAuthService } from "./supabase-auth.service";
import { EmailService } from "../notifications/email.service";

@Module({
  controllers: [AuthController],
  // EmailService is dependency-free (Resend via fetch); provide it directly so
  // signup verification can email codes without importing all of Notifications.
  providers: [SupabaseAuthService, SupabaseAuthGuard, EmailService],
  exports: [SupabaseAuthService, SupabaseAuthGuard]
})
export class AuthModule {}
