import { IsISO8601, IsNumber, IsOptional, IsString, Min } from "class-validator";

export class CreateDailyCloseDto {
  @IsString()
  storeId: string;

  @IsString()
  employeeId: string;

  @IsISO8601()
  date: string;

  @IsNumber()
  @Min(0)
  cashSales: number;

  @IsNumber()
  @Min(0)
  cardSales: number;

  @IsNumber()
  @Min(0)
  totalSales: number;

  @IsNumber()
  @Min(0)
  tax: number;

  @IsNumber()
  @Min(0)
  refunds: number;

  @IsNumber()
  @Min(0)
  discounts: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  lottery?: number;

  @IsNumber()
  @Min(0)
  countedCash: number;

  @IsNumber()
  @Min(0)
  safeDropAmount: number;

  @IsNumber()
  @Min(0)
  expenses: number;

  @IsString()
  @IsOptional()
  notes?: string;
}
