import { Body, Controller, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { SupabaseAuthGuard } from "../auth/supabase-auth.guard";
import { SuperAdminGuard } from "../auth/super-admin.guard";
import { CreatePartnerDto } from "./dto/create-partner.dto";
import { UpdatePartnerDto } from "./dto/update-partner.dto";
import { PartnersService } from "./partners.service";

@ApiTags("Partners")
@ApiBearerAuth()
@Controller("partners")
@UseGuards(SupabaseAuthGuard, SuperAdminGuard)
export class PartnersController {
  constructor(private readonly partners: PartnersService) {}

  @Get()
  list() {
    return this.partners.list();
  }

  @Post()
  create(@Body() dto: CreatePartnerDto) {
    return this.partners.create(dto);
  }

  @Get(":id")
  get(@Param("id") id: string) {
    return this.partners.get(id);
  }

  @Get(":id/funnel")
  funnel(@Param("id") id: string) {
    return this.partners.funnel(id);
  }

  @Get(":id/referrals")
  referrals(@Param("id") id: string) {
    return this.partners.referredAccounts(id);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdatePartnerDto) {
    return this.partners.update(id, dto);
  }
}
