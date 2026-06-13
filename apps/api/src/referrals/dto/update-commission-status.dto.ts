import { IsIn, IsOptional, IsString, MaxLength } from "class-validator";

// Admin transitions for a payout-queue row. APPROVED and PAID move it forward;
// REVERSED voids it (e.g. a manual clawback). `payoutReference` is required
// when marking PAID — the service enforces that.
export class UpdateCommissionStatusDto {
  @IsString() @IsIn(["APPROVED", "PAID", "REVERSED"]) status: "APPROVED" | "PAID" | "REVERSED";
  @IsOptional() @IsString() @MaxLength(200) payoutReference?: string;
}
