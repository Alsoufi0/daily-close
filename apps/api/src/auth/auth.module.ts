import { Module } from "@nestjs/common";
import { AuthController } from "./auth.controller";
import { SupabaseAuthGuard } from "./supabase-auth.guard";
import { SupabaseAuthService } from "./supabase-auth.service";

@Module({
  controllers: [AuthController],
  providers: [SupabaseAuthService, SupabaseAuthGuard],
  exports: [SupabaseAuthService, SupabaseAuthGuard]
})
export class AuthModule {}
