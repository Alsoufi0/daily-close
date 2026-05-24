import { IsIn, IsISO8601, IsOptional, IsString } from "class-validator";

export class ReportQueryDto {
  @IsOptional()
  @IsISO8601({ strict: false })
  from?: string;

  @IsOptional()
  @IsISO8601({ strict: false })
  to?: string;

  @IsOptional()
  @IsIn(["last-day", "last-week", "last-month"])
  quick?: "last-day" | "last-week" | "last-month";

  @IsOptional()
  @IsString()
  storeId?: string;

  @IsOptional()
  @IsString()
  employeeId?: string;

  @IsOptional()
  @IsIn(["en", "ar", "es", "hi"])
  lang?: "en" | "ar" | "es" | "hi";
}
