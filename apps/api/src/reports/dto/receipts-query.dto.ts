import { IsISO8601, IsOptional, IsString } from "class-validator";

export class ReceiptsQueryDto {
  @IsString()
  storeId: string;

  @IsOptional()
  @IsISO8601({ strict: false })
  from?: string;

  @IsOptional()
  @IsISO8601({ strict: false })
  to?: string;
}
