import { IsEmail, IsString, MaxLength, MinLength } from "class-validator";

export class InviteEmployeeDto {
  @IsString() @MinLength(2) @MaxLength(80) name: string;
  @IsEmail() email: string;
  @IsString() storeId: string;
}
