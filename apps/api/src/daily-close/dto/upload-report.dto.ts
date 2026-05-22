import { IsOptional, IsString } from "class-validator";

export class UploadReportDto {
  @IsString()
  storeId: string;

  @IsString()
  fileName: string;

  @IsString()
  contentType: string;

  @IsString()
  @IsOptional()
  base64Data?: string;

  @IsString()
  @IsOptional()
  imageUrl?: string;
}
