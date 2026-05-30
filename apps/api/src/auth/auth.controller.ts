import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Headers,
  Post,
  UnauthorizedException,
  UseGuards
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
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

  // Apple Guideline 5.1.1(v) requires in-app account deletion for any app
  // that allows sign-up. Cancels Stripe sub, cascades user data, soft-deletes
  // owned stores, anonymizes the user row (the daily_close FK pins it), and
  // deletes the Supabase auth user. Throttled — destructive endpoint, but a
  // legitimate user retrying after a network blip is normal.
  @Delete("me")
  @ApiBearerAuth()
  @UseGuards(SupabaseAuthGuard)
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  deleteMe(@CurrentUser() user: RequestUser) {
    return this.auth.deleteAccount(user);
  }

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
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
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

  @Post("signup-owner")
  // 5 signups per IP per minute — generous enough for a real user retrying
  // a typo'd password, tight enough to block enumeration scripts.
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  async signupOwner(@Body() body: { email?: string; phone?: string; name?: string; password?: string }) {
    if (!body?.email && !body?.phone) throw new BadRequestException("Email or phone is required.");
    if (!body?.name) throw new BadRequestException("Name is required.");
    if (!body?.password) throw new BadRequestException("Password is required.");
    return this.auth.signupOwner({
      email: body.email,
      phone: body.phone,
      name: body.name,
      password: body.password
    });
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
  // Even with the SETUP_ADMIN_KEY gate, a tight throttle keeps a leaked key
  // from being weaponised for account spam.
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
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
