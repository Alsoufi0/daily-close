import { IsString, IsUrl } from "class-validator";

export class ScanReportDto {
  @IsUrl()
  imageUrl: string;

  @IsString()
  storeId: string;
}
