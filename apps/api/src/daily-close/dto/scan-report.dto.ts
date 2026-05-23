import { IsString } from "class-validator";

export class ScanReportDto {
  @IsString()
  imageUrl: string;

  @IsString()
  storeId: string;
}
