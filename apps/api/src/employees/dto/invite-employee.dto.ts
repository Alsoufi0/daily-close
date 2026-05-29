import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export class InviteEmployeeDto {
  @IsString() @MinLength(2) @MaxLength(80) name: string;
  // Provide email OR phone — the service requires at least one. Phone is
  // expected in E.164 form, e.g. "+15551234567". Both can coexist later
  // (e.g. when the owner adds the second contact channel for SMS).
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() @MinLength(8) @MaxLength(20) phone?: string;
  @IsString() storeId: string;
}
