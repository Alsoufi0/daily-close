import { Controller, Get, HttpCode, ServiceUnavailableException } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { PrismaService } from "../prisma/prisma.service";

@ApiTags("Health")
@Controller("health")
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @HttpCode(200)
  liveness() {
    return {
      status: "ok",
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    };
  }

  @Get("ready")
  @HttpCode(200)
  async readiness() {
    try {
      await this.prisma.$queryRawUnsafe("SELECT 1");
      return { status: "ok", db: "up" };
    } catch (error: any) {
      throw new ServiceUnavailableException({ status: "fail", db: "down", error: error?.message });
    }
  }
}
