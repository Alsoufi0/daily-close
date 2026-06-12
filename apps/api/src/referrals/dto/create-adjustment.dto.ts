import { IsNumber, IsOptional, IsString, MaxLength, MinLength } from "class-validator";

// A manual ledger entry so payouts reconcile: a positive `amount` is a bonus,
// a negative `amount` is a clawback. Always tied to a partner; never tied to a
// Stripe invoice (stripe_invoice_id stays null, kind = ADJUSTMENT).
export class CreateAdjustmentDto {
  @IsString() partnerId: string;
  // Commission currency units (dollars), e.g. 25 or -49.99.
  @IsNumber() amount: number;
  @IsString() @MinLength(2) @MaxLength(500) note: string;
  // Billing-period label "YYYY-MM". Defaults to the current month when omitted.
  @IsOptional() @IsString() @MaxLength(7) period?: string;
}
