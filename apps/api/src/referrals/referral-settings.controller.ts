import { Body, Controller, Get, Patch, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { SupabaseAuthGuard } from "../auth/supabase-auth.guard";
import { SuperAdminGuard } from "../auth/super-admin.guard";
import { AppSettingsService } from "./app-settings.service";
import { UpdateSettingsDto } from "./dto/update-settings.dto";

@ApiTags("Referral Settings")
@ApiBearerAuth()
@Controller("referral-settings")
@UseGuards(SupabaseAuthGuard, SuperAdminGuard)
export class ReferralSettingsController {
  constructor(private readonly settings: AppSettingsService) {}

  @Get()
  async get() {
    const s = await this.settings.get();
    return { defaultCommissionRate: Number(s.defaultCommissionRate), updatedAt: s.updatedAt };
  }

  @Patch()
  async update(@Body() dto: UpdateSettingsDto) {
    const s = await this.settings.updateDefaultRate(dto.defaultCommissionRate);
    return { defaultCommissionRate: Number(s.defaultCommissionRate), updatedAt: s.updatedAt };
  }
}
