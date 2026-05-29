import { Logger, ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "./app.module";
import { AllExceptionsFilter } from "./common/all-exceptions.filter";

// Refuse to boot if the legacy ALLOW_DEMO_AUTH flag is set to a TRUTHY value.
// The header-based demo backdoor it once enabled was removed because a single
// env-var typo in any environment turned the entire API into an auth-free
// surface. Failing closed at startup makes the regression impossible.
//
// Why only truthy (not "any value"): existing render.yaml setups predate the
// removal and have ALLOW_DEMO_AUTH=false sitting in env-vars as documentation.
// That's harmless — the actual backdoor code is gone — so we tolerate it.
// Anything that would have flipped the bypass on (true / 1 / yes) still
// crashes the boot loudly.
{
  const v = (process.env.ALLOW_DEMO_AUTH || "").toLowerCase().trim();
  if (v === "true" || v === "1" || v === "yes" || v === "on") {
    // eslint-disable-next-line no-console
    console.error(
      "[FATAL] ALLOW_DEMO_AUTH is set to a truthy value. The demo-auth " +
        "backdoor was removed for security. Set the env var to 'false' " +
        "or unset it entirely, then redeploy."
    );
    process.exit(1);
  }
}

// Sentry is initialised when SENTRY_DSN is set. Missing-DSN in production is
// logged loudly but no longer fatal — a hard-fail at boot took the whole API
// down before a DSN had been provisioned. Re-tighten once Sentry is wired.
if (process.env.SENTRY_DSN) {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const Sentry = require("@sentry/node");
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || "development",
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0.1)
  });
} else if (process.env.NODE_ENV === "production") {
  // eslint-disable-next-line no-console
  console.warn(
    "[WARN] SENTRY_DSN not set in production — errors will not be reported. Configure ASAP."
  );
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
      // Production custom domain. Hardcoded alongside *.vercel.app so the live
      // site keeps working even if the ALLOWED_ORIGINS env var drifts stale —
      // it did: it still pointed at the old daily-close-mvp.vercel.app after
      // the dailyclose.us cutover, which 404'd every browser API call.
      if (host === "dailyclose.us" || host.endsWith(".dailyclose.us")) return callback(null, true);
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
  // Global exception filter — guarantees every 500 lands in stdout with a
  // full stack trace so Render's log tail surfaces the actual cause.
  // See apps/api/src/common/all-exceptions.filter.ts for details.
  app.useGlobalFilters(new AllExceptionsFilter());
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
