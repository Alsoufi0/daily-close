import { Module } from "@nestjs/common";
import { PosParserService } from "./pos-parser.service";

@Module({
  providers: [PosParserService],
  exports: [PosParserService]
})
export class PosParsersModule {}
