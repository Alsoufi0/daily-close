import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

// The single settings row always lives under this id (enforced by a CHECK in
// migration 011). All reads/writes go through here so the rest of the code
// never has to know about the "global" key.
const SETTINGS_ID = "global";

@Injectable()
export class AppSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Read the settings row, creating it with defaults if it's somehow missing. */
  async get() {
    return this.prisma.appSetting.upsert({
      where: { id: SETTINGS_ID },
      update: {},
      create: { id: SETTINGS_ID }
    });
  }

  /** The platform default commission rate as a plain number (e.g. 0.25). */
  async getDefaultRate(): Promise<number> {
    const settings = await this.get();
    return Number(settings.defaultCommissionRate);
  }

  async updateDefaultRate(rate: number) {
    return this.prisma.appSetting.upsert({
      where: { id: SETTINGS_ID },
      update: { defaultCommissionRate: new Prisma.Decimal(rate) },
      create: { id: SETTINGS_ID, defaultCommissionRate: new Prisma.Decimal(rate) }
    });
  }
}
