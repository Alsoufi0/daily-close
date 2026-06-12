import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf
} from "class-validator";

export class UpdatePartnerDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(120) name?: string;
  @IsOptional() @IsString() @MaxLength(200) contact?: string;
  @IsOptional() @IsString() @MaxLength(500) payoutDetails?: string;
  @IsOptional() @IsBoolean() active?: boolean;
  // Pass a number in (0, 1] to set a per-partner override, or null to clear it
  // (fall back to the platform default). `ref_code` is intentionally NOT
  // editable here — codes are generated once and never regenerated.
  @IsOptional()
  @ValidateIf((o) => o.commissionRate !== null)
  @IsNumber()
  @Min(0)
  @Max(1)
  commissionRate?: number | null;
}
