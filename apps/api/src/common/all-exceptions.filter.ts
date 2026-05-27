import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger
} from "@nestjs/common";
import type { Request, Response } from "express";

/**
 * Global exception filter (audit defensive-fix).
 *
 * Default NestJS behaviour for an unhandled throw is to log "Unhandled
 * exception" with the stack to stdout AND return `{statusCode: 500,
 * message: "Internal server error"}` to the client. That's mostly fine,
 * but in production we've seen Render's logs show only the response line
 * (`POST /... 500 200ms`) without the stack — the framework log gets
 * truncated or sampled before reaching the dashboard.
 *
 * This filter:
 *   - Logs every unhandled exception with full stack to `console.error`
 *     directly, so the trace ALWAYS lands in stdout (and Sentry when
 *     configured).
 *   - Preserves the existing client response shape (sanitised — never
 *     leak stack frames or schema names to API consumers).
 *   - Includes method + url + status in the log line so a `grep 500`
 *     against Render's log tail finds it instantly.
 *   - Tries the Sentry SDK if SENTRY_DSN is set; falls back to console
 *     otherwise. Required-Sentry-in-prod (audit fix #10) means the
 *     SDK is loaded in main.ts before this filter runs.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger("UnhandledException");

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const isHttp = exception instanceof HttpException;
    const status = isHttp ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const message = (exception as any)?.message || "Internal server error";
    const stack = (exception as any)?.stack;

    // Always log non-2xx with full context. 4xx errors get logged at warn
    // level (expected — bad input, auth failure), 5xx at error level (bug).
    const tag = `${request.method} ${request.originalUrl || request.url} → ${status}`;
    if (status >= 500) {
      // eslint-disable-next-line no-console
      console.error(`[unhandled] ${tag}: ${message}\n${stack || "(no stack)"}`);
      this.logger.error(`${tag}: ${message}`, stack);
      this.captureWithSentry(exception, request, status);
    } else if (status >= 400 && !isHttp) {
      // Unusual: a non-HttpException that resolved to a 4xx. Log just in case.
      this.logger.warn(`${tag}: ${message}`);
    }

    const body = isHttp ? exception.getResponse() : {
      statusCode: status,
      message: status === 500 ? "Internal server error" : message,
      timestamp: new Date().toISOString()
    };

    response.status(status).json(body);
  }

  private captureWithSentry(exception: unknown, req: Request, status: number) {
    if (!process.env.SENTRY_DSN) return;
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const Sentry = require("@sentry/node");
      Sentry.captureException(exception, {
        contexts: {
          http: {
            method: req.method,
            url: req.originalUrl || req.url,
            status_code: status
          }
        },
        tags: { source: "AllExceptionsFilter" }
      });
    } catch {
      // Sentry SDK not installed in this build — silent fall-through.
    }
  }
}
