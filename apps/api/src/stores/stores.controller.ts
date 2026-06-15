import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../auth/current-user.decorator";
import { RequestUser } from "../auth/request-user";
import { SupabaseAuthGuard } from "../auth/supabase-auth.guard";
import { SubscriptionGuard } from "../subscriptions/subscription.guard";
import { StoresService } from "./stores.service";
import { CreateStoreDto } from "./dto/create-store.dto";
import { UpdateStoreDto } from "./dto/update-store.dto";

@ApiTags("Stores")
@ApiBearerAuth()
@Controller("stores")
@UseGuards(SupabaseAuthGuard)
export class StoresController {
  constructor(private readonly storesService: StoresService) {}

  @Get()
  @UseGuards(SubscriptionGuard)
  list(@CurrentUser() user: RequestUser) {
    return this.storesService.listForUser(user);
  }

  @Post()
  @UseGuards(SubscriptionGuard)
  create(@CurrentUser() user: RequestUser, @Body() input: CreateStoreDto) {
    return this.storesService.createForOwner(user, input);
  }

  @Patch(":id")
  @UseGuards(SubscriptionGuard)
  update(
    @CurrentUser() user: RequestUser,
    @Param("id") id: string,
    @Body() input: UpdateStoreDto
  ) {
    return this.storesService.updateForOwner(user, id, input);
  }

  // Pause / resume are intentionally NOT behind the SubscriptionGuard: an owner
  // must be able to choose which stores to keep (and stop paying for the rest)
  // even after the trial has lapsed. They only mutate the owner's own store and
  // re-sync the Stripe quantity.
  @Patch(":id/pause")
  pause(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.storesService.pauseForOwner(user, id);
  }

  @Patch(":id/resume")
  resume(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.storesService.resumeForOwner(user, id);
  }

  @Delete(":id")
  @UseGuards(SubscriptionGuard)
  remove(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.storesService.deleteForOwner(user, id);
  }
}
