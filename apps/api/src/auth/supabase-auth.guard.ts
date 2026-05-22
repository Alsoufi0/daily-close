import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { SupabaseAuthService } from "./supabase-auth.service";
import { RequestUser } from "./request-user";

@Injectable()
export class SupabaseAuthGuard implements CanActivate {
  constructor(private readonly auth: SupabaseAuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{
      headers: Record<string, string | undefined>;
      user?: RequestUser;
    }>();

    const demoRole = request.headers["x-demo-role"];
    if (process.env.ALLOW_DEMO_AUTH === "true" && (demoRole === "owner" || demoRole === "employee")) {
      request.user = await this.auth.getDemoUser(demoRole);
      return true;
    }

    const authorization = request.headers.authorization;
    const token = authorization?.startsWith("Bearer ") ? authorization.slice(7) : undefined;
    if (!token) throw new UnauthorizedException("Missing bearer token.");

    request.user = await this.auth.getUserFromToken(token);
    return true;
  }
}
