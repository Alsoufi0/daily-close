import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  Post,
  UnauthorizedException,
  UseGuards
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { SessionProfile } from "@shared/types";
import { CurrentUser } from "./current-user.decorator";
import { RequestUser } from "./request-user";
import { SupabaseAuthGuard } from "./supabase-auth.guard";
import { SupabaseAuthService } from "./supabase-auth.service";

@ApiTags("Auth")
@Controller("auth")
export class AuthController {
  constructor(private readonly auth: SupabaseAuthService) {}

  @Get("profile")
  @ApiBearerAuth()
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

  // Called by the web app right after a Supabase sign-up succeeds.
  // Creates public.users + owners rows if they don't exist yet.
  @Post("bootstrap-owner")
  @ApiBearerAuth()
  async bootstrapOwner(
    @Headers("authorization") authorization: string | undefined,
    @Body() body: { name?: string }
  ): Promise<SessionProfile> {
    const token = authorization?.startsWith("Bearer ") ? authorization.slice(7) : undefined;
    if (!token) throw new UnauthorizedException("Missing bearer token.");
    if (body?.name && body.name.length > 80) throw new BadRequestException("Name too long.");
    const user = await this.auth.bootstrapOwnerFromToken(token, body?.name);
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

  /**
   * Admin-only: create an owner with email already confirmed and provision
   * their public.users + owners row. Bypasses Supabase's email verification —
   * use only until SMTP is wired up. Gated by SETUP_ADMIN_KEY header so it's
   * safe to leave deployed.
   *
   *   curl -X POST .../auth/admin-create-user \
   *     -H "x-setup-key: $SETUP_ADMIN_KEY" \
   *     -H "Content-Type: application/json" \
   *     -d '{"email":"owner@example.com","name":"Alex","password":"optional"}'
   */
  @Post("admin-create-user")
  async adminCreateUser(
    @Headers("x-setup-key") providedKey: string | undefined,
    @Body() body: { email?: string; name?: string; password?: string }
  ) {
    const expected = process.env.SETUP_ADMIN_KEY;
    if (!expected) {
      throw new ForbiddenException(
        "SETUP_ADMIN_KEY is not configured on the API. Set it in Render env first."
      );
    }
    if (providedKey !== expected) throw new ForbiddenException("Bad setup key.");
    if (!body?.email) throw new BadRequestException("email is required.");
    if (body.password && body.password.length < 8) {
      throw new BadRequestException("password must be at least 8 characters.");
    }
    return this.auth.adminCreateOwner({
      email: body.email,
      name: body.name,
      password: body.password
    });
  }
}
