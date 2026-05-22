import { Logger, ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "./app.module";

function securityHeaders(_req: unknown, res: { setHeader: (name: string, value: string) => void }, next: () => void) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  res.setHeader("Permissions-Policy", "camera=(), geolocation=(), microphone=()");
  next();
}

function parseOrigins(value: string | undefined): string[] | true {
  if (!value || value.trim() === "*") return true;
  return value.split(",").map((origin) => origin.trim()).filter(Boolean);
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const logger = new Logger("Bootstrap");

  app.use(securityHeaders);
  app.enableCors({
    origin: parseOrigins(process.env.ALLOWED_ORIGINS),
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]
  });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.enableShutdownHooks();

  const enableSwagger = process.env.ENABLE_SWAGGER === "true" || process.env.NODE_ENV !== "production";
  if (enableSwagger) {
    const config = new DocumentBuilder()
      .setTitle("SmokeShop Daily Close API")
      .setDescription("MVP API for daily store closing")
      .setVersion("0.1.0")
      .addBearerAuth()
      .build();
    SwaggerModule.setup("docs", app, SwaggerModule.createDocument(app, config));
    logger.log("Swagger docs available at /docs");
  }

  const port = Number(process.env.PORT) || 4000;
  await app.listen(port);
  logger.log(`API listening on :${port} (env=${process.env.NODE_ENV || "development"})`);
}

bootstrap();
