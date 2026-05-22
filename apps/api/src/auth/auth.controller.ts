import { Controller, Get, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { SessionProfile } from "@shared/types";
import { CurrentUser } from "./current-user.decorator";
import { RequestUser } from "./request-user";
import { SupabaseAuthGuard } from "./supabase-auth.guard";

@ApiTags("Auth")
@ApiBearerAuth()
@Controller("auth")
export class AuthController {
  @Get("profile")
  @UseGuards(SupabaseAuthGuard)
  getProfile(@CurrentUser() user: RequestUser): SessionProfile {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      ownerId: user.ownerId,
      employeeId: user.employeeId,
      storeId: user.storeId
    };
  }
}
