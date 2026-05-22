import { IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export class CreateStoreDto {
  @IsString() @MinLength(2) @MaxLength(80) storeName: string;
  @IsString() @IsOptional() @MaxLength(160) address?: string;
  @IsString() @IsOptional() @MaxLength(40) phone?: string;
  @IsString() @IsOptional() @MaxLength(40) timezone?: string;
  @IsString() @IsOptional() @MaxLength(5) closeTime?: string;
}
