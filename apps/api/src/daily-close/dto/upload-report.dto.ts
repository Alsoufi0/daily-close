import { IsOptional, IsString, Matches, MaxLength } from "class-validator";

// Base64 of a ~25 MB image is ~33.5 MB of characters; the express body limit is
// 25 MB (REQUEST_BODY_LIMIT). Cap a little above that so a legitimate large
// photo is never rejected here, but a runaway/abusive payload is.
const MAX_BASE64_CHARS = 35_000_000;

export class UploadReportDto {
  @IsString()
  @MaxLength(128)
  storeId: string;

  @IsString()
  @MaxLength(256)
  fileName: string;

  // Both the web and mobile clients always send an image mime type (defaulting
  // to image/jpeg), so restrict to image/* — this rejects garbage/non-image
  // payloads without affecting any real upload.
  @IsString()
  @Matches(/^image\/[a-z0-9.+-]+$/i, { message: "contentType must be an image type (image/*)." })
  contentType: string;

  @IsString()
  @IsOptional()
  @MaxLength(MAX_BASE64_CHARS, { message: "Image is too large." })
  base64Data?: string;

  @IsString()
  @IsOptional()
  @MaxLength(2048)
  imageUrl?: string;
}
