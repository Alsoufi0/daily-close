import {
  BadRequestException,
  Body,
  Controller,
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
}
