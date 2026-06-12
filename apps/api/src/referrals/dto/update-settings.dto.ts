import { IsNumber, Max, Min } from "class-validator";

export class UpdateSettingsDto {
  // Platform default commission rate as a fraction in (0, 1] — e.g. 0.25.
  @IsNumber() @Min(0) @Max(1) defaultCommissionRate: number;
}
