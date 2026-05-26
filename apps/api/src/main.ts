import { Logger, ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "./app.module";

// Refuse to boot if the legacy ALLOW_DEMO_AUTH flag is set to anything. The
// header-based demo backdoor it once enabled was removed because a single
// env-var typo in any environment turned the entire API into an auth-free
// surface. Failing closed at startup makes the regression impossible.
if (process.env.ALLOW_DEMO_AUTH !== undefined && process.env.ALLOW_DEMO_AUTH !== "") {
  // eslint-disable-next-line no-console
  console.error(
    "[FATAL] ALLOW_DEMO_AUTH is set. The demo-auth backdoor was removed for security. " +
      "Unset this environment variable in every deployment and redeploy."
  );
  process.exit(1);
}

// Initialise Sentry as early as possible, but only when a DSN is configured.
if (process.env.SENTRY_DSN) {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const Sentry = require("@sentry/node");
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || "development",
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0.1)
  });
}

function securityHeaders(_req: unknown, res: { setHeader: (name: string, value: string) => void }, next: () => void) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  res.setHeader("Permissions-Policy", "camera=(), geolocation=(), microphone=()");
  next();
}

// Allow any *.vercel.app preview, localhost dev, and explicit allowlist entries.
// The API still requires a valid Supabase JWT for every protected route — CORS
// is the wrong place to enforce app-level access control. Being permissive here
// stops a benign env-var typo from killing every browser API call.
function originChecker(value: string | undefined) {
  const explicit = (value || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  if (explicit.includes("*")) return true;

  return (
    requestOrigin: string | undefined,
    callback: (err: Error | null, allow?: boolean) => void
  ) => {
    // No Origin header (server-to-server, curl, healthchecks) → allow.
    if (!requestOrigin) return callback(null, true);
    if (explicit.includes(requestOrigin)) return callback(null, true);
    try {
      const host = new URL(requestOrigin).hostname;
      if (host === "localhost" || host === "127.0.0.1") return callback(null, true);
      if (host.endsWith(".vercel.app")) return callback(null, true);
    } catch {
      /* fall through to deny */
    }
    return callback(null, false);
  };
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const logger = new Logger("Bootstrap");

  const express = require("express") as {
    json: (options: { limit: string }) => unknown;
    urlencoded: (options: { extended: boolean; limit: string }) => unknown;
  };
  app.use(express.json({ limit: process.env.REQUEST_BODY_LIMIT || "25mb" }));
  app.use(express.urlencoded({ extended: true, limit: process.env.REQUEST_BODY_LIMIT || "25mb" }));
  app.use(securityHeaders);
  app.enableCors({
    origin: originChecker(process.env.ALLOWED_ORIGINS),
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]
  });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.enableShutdownHooks();

  const enableSwagger = process.env.ENABLE_SWAGGER === "true" || process.env.NODE_ENV !== "production";
  if (enableSwagger) {
    const config = new DocumentBuilder()
      .setTitle("Daily Close API")
      .setDescription("API for daily store closing — owners and employees")
      .setVersion("1.0.0")
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
