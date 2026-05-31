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
    const isManager = Array.isArray(user.managedStoreIds) && user.managedStoreIds.length > 0;
    if (!user.ownerId || (user.role !== "STORE_OWNER" && !isManager)) {
      // Plain employees write closes but never set up billing; only owners are
      // charged. Per-store managers act ON the owner's account, so they ARE
      // gated by that owner's subscription (below).
      return true;
    }
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
