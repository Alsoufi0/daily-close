import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../auth/current-user.decorator";
import { RequestUser } from "../auth/request-user";
import { SupabaseAuthGuard } from "../auth/supabase-auth.guard";
import { SubscriptionGuard } from "../subscriptions/subscription.guard";
import { EmployeesService } from "./employees.service";
import { InviteEmployeeDto } from "./dto/invite-employee.dto";

@ApiTags("Employees")
@ApiBearerAuth()
@Controller("employees")
@UseGuards(SupabaseAuthGuard)
export class EmployeesController {
  constructor(private readonly employees: EmployeesService) {}

  @Get()
  list(@CurrentUser() user: RequestUser) {
    return this.employees.listForOwner(user);
  }

  @Post("invite")
  @UseGuards(SubscriptionGuard)
  invite(@CurrentUser() user: RequestUser, @Body() input: InviteEmployeeDto) {
    return this.employees.invite(user, input);
  }

  @Post(":id/reset-password")
  resetPassword(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.employees.resetPassword(user, id);
  }

  @Patch(":id/admin-access")
  setAdminAccess(
    @CurrentUser() user: RequestUser,
    @Param("id") id: string,
    @Body() body: { isAdmin?: boolean }
  ) {
    return this.employees.setAdminAccess(user, id, Boolean(body?.isAdmin));
  }

  @Delete(":id")
  remove(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.employees.remove(user, id);
  }

  /**
   * Assign an existing employee (`:id` is an existing assignment row id)
   * to ALSO work at a different store the owner owns.
   *
   * POST /employees/:id/assignments
   *   body: { storeId: "<target store id>" }
   *
   * Idempotent — re-posting the same target returns the existing
   * assignment with `alreadyAssigned: true`.
   */
  @Post(":id/assignments")
  @UseGuards(SubscriptionGuard)
  assignToStore(
    @CurrentUser() user: RequestUser,
    @Param("id") id: string,
    @Body() body: { storeId?: string }
  ) {
    if (!body?.storeId) throw new Error("storeId is required");
    return this.employees.assignToStore(user, id, body.storeId);
  }

  /**
   * List all stores a given employee-user is currently assigned to,
   * scoped to the owner's stores. Used by the admin UI to show
   * "Maya works at: Store #1, Store #3" with per-row unassign actions.
   *
   * Param is the USER id (not the assignment-row id) since one user
   * has many assignment rows.
   */
  @Get("by-user/:userId/assignments")
  listAssignmentsForUser(
    @CurrentUser() user: RequestUser,
    @Param("userId") userId: string
  ) {
    return this.employees.listAssignmentsForUser(user, userId);
  }
}
