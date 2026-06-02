import { Controller, Get, HttpCode, Inject, ServiceUnavailableException } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { PrismaService } from "../prisma/prisma.service";
import type { OCRService } from "../ocr/ocr.service";

@ApiTags("Health")
@Controller("health")
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    @Inject("OCRService") private readonly ocr: OCRService
  ) {}

  @Get()
  @HttpCode(200)
  liveness() {
    return {
      status: "ok",
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      // Deployed git SHA so we can verify WHICH commit is actually live
      // without dashboard access. Render injects RENDER_GIT_COMMIT at build.
      commit: (process.env.RENDER_GIT_COMMIT || "unknown").slice(0, 7)
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

  // Diagnostic: which OCR provider got resolved and which keys exist.
  // Never returns the key values themselves — just true/false flags.
  @Get("ocr")
  @HttpCode(200)
  ocrStatus() {
    return {
      provider: (this.ocr as any).constructor?.name ?? "unknown",
      explicitMode: process.env.OCR_MODE || null,
      keys: {
        GOOGLE_VISION_API_KEY: Boolean(process.env.GOOGLE_VISION_API_KEY),
        OCR_SPACE_API_KEY: Boolean(process.env.OCR_SPACE_API_KEY)
      }
    };
  }
}
