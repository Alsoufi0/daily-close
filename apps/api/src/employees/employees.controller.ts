import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
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
}
