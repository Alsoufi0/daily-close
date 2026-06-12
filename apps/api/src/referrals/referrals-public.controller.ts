import { Controller, Get, Param } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { PartnersService } from "./partners.service";

// Public (unauthenticated) referral endpoints. The web /r/[code] page calls
// this when a prospect lands from a QR/link: it records the visit (funnel
// top) and reports whether the code is valid so the page knows to carry the
// ref into signup. GET only, so the origin-check middleware leaves it alone.
@ApiTags("Referrals")
@Controller("referrals")
export class ReferralsPublicController {
  constructor(private readonly partners: PartnersService) {}

  @Get("r/:code")
  resolve(@Param("code") code: string) {
    return this.partners.recordScan(code);
  }
}
