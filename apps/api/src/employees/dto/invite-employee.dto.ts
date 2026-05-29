import {
  IsBoolean,
  IsDefined,
  IsEmail,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested
} from "class-validator";
import { Type } from "class-transformer";

// Twilio A2P 10DLC: when a phone is supplied we must capture the exact
// consent shown to the owner who attested on the employee's behalf.
// `granted` MUST be true and `text` is the verbatim string the owner
// saw — both are persisted on `phone_consents` for the carrier audit.
export class InviteConsentDto {
  @IsBoolean() granted: boolean;
  @IsString() @MinLength(1) @MaxLength(2000) text: string;
}

export class InviteEmployeeDto {
  @IsString() @MinLength(2) @MaxLength(80) name: string;
  // Provide email OR phone — the service requires at least one. Phone is
  // expected in E.164 form, e.g. "+15551234567". Both can coexist later
  // (e.g. when the owner adds the second contact channel for SMS).
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() @MinLength(8) @MaxLength(20) phone?: string;
  @IsString() storeId: string;
  // Required when `phone` is set. Class-validator can't express a
  // conditional requirement cleanly across DTOs, so the service does
  // the "required when phone present" check and throws BadRequest.
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => InviteConsentDto)
  consent?: InviteConsentDto;
}
