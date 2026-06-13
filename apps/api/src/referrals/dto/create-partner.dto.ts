import { IsNumber, IsOptional, IsString, Max, MaxLength, Min, MinLength } from "class-validator";

export class CreatePartnerDto {
  @IsString() @MinLength(2) @MaxLength(120) name: string;
  @IsString() @IsOptional() @MaxLength(200) contact?: string;
  @IsString() @IsOptional() @MaxLength(500) payoutDetails?: string;
  // Optional per-partner override of the platform default rate. A fraction in
  // (0, 1] — e.g. 0.25 for 25%. Omit to use the platform default.
  @IsOptional() @IsNumber() @Min(0) @Max(1) commissionRate?: number;
}
