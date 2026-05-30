import { Type } from "class-transformer";
import {
  IsArray,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested
} from "class-validator";

export class ExpenseItemDto {
  @IsString()
  category: string;

  @IsNumber()
  @Min(0)
  amount: number;

  @IsString()
  @IsOptional()
  description?: string;
}

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

  // Optional itemized breakdown of `expenses`. When present and non-empty,
  // the API creates one Expense row per item and recomputes the cached
  // `expenses` total from the items (the client-sent total is ignored to
  // keep the breakdown consistent with the total).
  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => ExpenseItemDto)
  expenseItems?: ExpenseItemDto[];
}
