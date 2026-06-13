import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { RequestUser } from "./request-user";

/**
 * Gates a route to platform staff (User.role === SUPER_ADMIN). MUST be listed
 * AFTER SupabaseAuthGuard in @UseGuards so `request.user` is already populated:
 *
 *   @UseGuards(SupabaseAuthGuard, SuperAdminGuard)
 *
 * Used for the referral/partner/payout admin surfaces, which expose partner PII
 * and payout money and must never be reachable by store owners or employees.
 */
@Injectable()
export class SuperAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{ user?: RequestUser }>();
    if (request.user?.role !== "SUPER_ADMIN") {
      throw new ForbiddenException("Platform admin access required.");
    }
    return true;
  }
}
