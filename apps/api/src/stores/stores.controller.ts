import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../auth/current-user.decorator";
import { RequestUser } from "../auth/request-user";
import { SupabaseAuthGuard } from "../auth/supabase-auth.guard";
import { SubscriptionGuard } from "../subscriptions/subscription.guard";
import { StoresService } from "./stores.service";
import { CreateStoreDto } from "./dto/create-store.dto";

@ApiTags("Stores")
@ApiBearerAuth()
@Controller("stores")
@UseGuards(SupabaseAuthGuard)
export class StoresController {
  constructor(private readonly storesService: StoresService) {}

  @Get()
  list(@CurrentUser() user: RequestUser) {
    return this.storesService.listForUser(user);
  }

  @Post()
  @UseGuards(SubscriptionGuard)
  create(@CurrentUser() user: RequestUser, @Body() input: CreateStoreDto) {
    return this.storesService.createForOwner(user, input);
  }
}
