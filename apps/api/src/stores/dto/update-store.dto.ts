import { IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export class UpdateStoreDto {
  @IsString() @MinLength(2) @MaxLength(80) @IsOptional() storeName?: string;
  @IsString() @MaxLength(160) @IsOptional() address?: string;
  @IsString() @MaxLength(40) @IsOptional() phone?: string;
  @IsString() @MaxLength(40) @IsOptional() timezone?: string;
  @IsString() @MaxLength(5) @IsOptional() closeTime?: string;
}
