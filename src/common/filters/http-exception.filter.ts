import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  Optional,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ErrorLogService } from '@/error-log/error-log.service';
import { ErrorSeverity } from '@/error-log/entities/error-log.entity';

@Injectable()
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  constructor(
    // Optional: not available during early bootstrap or in tests that don't
    // provide ErrorLogModule. The filter still works without it.
    @Optional() private readonly errorLogService?: ErrorLogService,
  ) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let statusCode: number;
    let message: string;

    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const responseBody = exception.getResponse();

      // NestJS may nest the message inside { message: string | string[] }
      if (typeof responseBody === 'string') {
        message = responseBody;
      } else if (
        typeof responseBody === 'object' &&
        responseBody !== null &&
        'message' in responseBody
      ) {
        const raw = (responseBody as Record<string, unknown>).message;
        message = Array.isArray(raw) ? raw.join(', ') : String(raw);
      } else {
        message = exception.message;
      }
    } else {
      statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
      message = 'Error interno del servidor';

      // Log unexpected errors with full stack for debugging
      this.logger.error(
        `[${request.method}] ${request.url} → 500`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    // Log 4xx only as warnings, skip 401/403 noise
    if (statusCode >= 400 && statusCode < 500 && statusCode !== 401 && statusCode !== 403) {
      this.logger.warn(
        `[${request.method}] ${request.url} → ${statusCode} — ${message}`,
      );
    }

    // Persist 5xx errors to the database for analysis.
    // - Fire-and-forget (.catch) so a DB failure never blocks the HTTP response.
    // - Guard against the /error-logs path to prevent an infinite logging loop.
    if (
      statusCode >= 500 &&
      this.errorLogService &&
      !request.url?.includes('/error-logs')
    ) {
      const user = (request as Request & { user?: { sub?: string } }).user;

      this.errorLogService
        .createFromBackend({
          message:
            exception instanceof Error ? exception.message : String(exception),
          stack:
            exception instanceof Error ? (exception.stack ?? null) : null,
          path: request.url ?? '/',
          method: request.method ?? 'UNKNOWN',
          userId: user?.sub ?? null,
          shopId: null, // shopId is not in the JWT payload
          severity: ErrorSeverity.CRITICAL,
          source: 'backend',
        })
        .catch(() => {});
    }

    response.status(statusCode).json({
      statusCode,
      message,
      timestamp: new Date().toISOString(),
    });
  }
}
