import { IsNumber, IsOptional, IsString, Min } from "class-validator";

export class EditDailyCloseDto {
  @IsNumber() @Min(0) @IsOptional() cashSales?: number;
  @IsNumber() @Min(0) @IsOptional() cardSales?: number;
  @IsNumber() @Min(0) @IsOptional() totalSales?: number;
  @IsNumber() @Min(0) @IsOptional() tax?: number;
  @IsNumber() @Min(0) @IsOptional() refunds?: number;
  @IsNumber() @Min(0) @IsOptional() discounts?: number;
  @IsNumber() @Min(0) @IsOptional() lottery?: number;
  @IsNumber() @Min(0) @IsOptional() countedCash?: number;
  @IsNumber() @Min(0) @IsOptional() safeDropAmount?: number;
  @IsNumber() @Min(0) @IsOptional() expenses?: number;
  @IsString() @IsOptional() notes?: string;
}
