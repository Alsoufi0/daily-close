import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable
} from "@nestjs/common";
import { RequestUser } from "../auth/request-user";
import { SubscriptionsService } from "./subscriptions.service";

@Injectable()
export class SubscriptionGuard implements CanActivate {
  constructor(private readonly subscriptions: SubscriptionsService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<{ user?: RequestUser }>();
    const user = req.user;
    if (!user) throw new ForbiddenException("Sign in required.");
    if (!user.ownerId) {
      // No owning account in context (e.g. a SUPER_ADMIN, or a brand-new user
      // with no store assignment yet) — there's no subscription to gate against.
      return true;
    }
    // Everyone who operates within an owning account is gated by that account's
    // subscription: the owner, per-store managers, AND plain employees. When the
    // owner stops paying the whole store is locked — previously plain employees
    // bypassed this guard, so an unpaid owner's staff could keep submitting
    // closes. `user.ownerId` for an employee is the owner of their store (set in
    // getUserFromToken from their primary assignment), so the lock follows the
    // store they work under. Data is never deleted; access resumes the moment
    // the owner renews.
    try {
      await this.subscriptions.ensureActiveForOwner(user.ownerId);
      return true;
    } catch (err: any) {
      if (err?.statusCode === 402) {
        throw new HttpException(
          {
            statusCode: HttpStatus.PAYMENT_REQUIRED,
            message: "Subscription expired. Please choose a plan to continue.",
            code: "SUBSCRIPTION_REQUIRED"
          },
          HttpStatus.PAYMENT_REQUIRED
        );
      }
      throw err;
    }
  }
}
