import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Between,
  FindOptionsWhere,
  LessThanOrEqual,
  MoreThanOrEqual,
  Repository,
} from 'typeorm';
import * as crypto from 'crypto';
import {
  ErrorLog,
  ErrorSeverity,
  ErrorSource,
} from './entities/error-log.entity';
import { CreateErrorLogDto } from './dto/create-error-log.dto';
import { GetErrorLogsDto } from './dto/get-error-logs.dto';

// ─── Internal types ───────────────────────────────────────────────────────────

interface InternalErrorLogPayload {
  message: string;
  stack?: string | null;
  context?: Record<string, unknown> | null;
  userId?: string | null;
  shopId?: string | null;
  path: string;
  method: string;
  severity?: ErrorSeverity;
  source: ErrorSource;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Returns the first 32 hex chars of SHA-256(message|path|method). */
function generateFingerprint(
  message: string,
  path: string,
  method: string,
): string {
  return crypto
    .createHash('sha256')
    .update(`${message}|${path}|${method}`)
    .digest('hex')
    .slice(0, 32);
}

/**
 * Infers severity from context when the caller does not supply one.
 *
 *  network_error              → medium
 *  api_error with status ≥500 → critical
 *  everything else            → low
 */
function inferSeverity(
  explicit?: ErrorSeverity,
  context?: Record<string, unknown> | null,
): ErrorSeverity {
  if (explicit) return explicit;
  const type = context?.type;
  const status = context?.status;
  if (type === 'network_error') return ErrorSeverity.MEDIUM;
  if (type === 'api_error' && typeof status === 'number' && status >= 500) {
    return ErrorSeverity.CRITICAL;
  }
  return ErrorSeverity.LOW;
}

const SEVERITY_RANK: Record<ErrorSeverity, number> = {
  [ErrorSeverity.LOW]: 0,
  [ErrorSeverity.MEDIUM]: 1,
  [ErrorSeverity.CRITICAL]: 2,
};

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class ErrorLogService {
  private readonly logger = new Logger(ErrorLogService.name);

  constructor(
    @InjectRepository(ErrorLog)
    private readonly errorLogRepo: Repository<ErrorLog>,
  ) {}

  // ── Public: called from HTTP controller (frontend errors) ──────────────────

  async createFromDto(dto: CreateErrorLogDto): Promise<void> {
    try {
      const message = dto.message.slice(0, 2000);
      const path = dto.path.slice(0, 500);
      const method = dto.method.slice(0, 20);
      const severity = inferSeverity(dto.severity, dto.context);
      const fingerprint = generateFingerprint(message, path, method);

      const existing = await this.errorLogRepo.findOne({
        where: { fingerprint },
      });

      if (existing) {
        const nextSeverity =
          SEVERITY_RANK[severity] > SEVERITY_RANK[existing.severity]
            ? severity
            : existing.severity;

        await this.errorLogRepo.update(existing.id, {
          occurrences: existing.occurrences + 1,
          lastSeenAt: new Date(),
          severity: nextSeverity,
        });
        return;
      }

      await this.save({
        message,
        stack: dto.stack ?? null,
        context: dto.context ?? null,
        userId: dto.userId ?? null,
        shopId: dto.shopId ?? null,
        path,
        method,
        severity,
        source: 'frontend',
        fingerprint,
      });
    } catch (error) {
      this.logger.warn(
        'createFromDto failed (ignored) — error_logs table may not exist yet',
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  // ── Public: called internally from exception filter (backend errors) ────────

  async createFromBackend(payload: InternalErrorLogPayload): Promise<void> {
    try {
      const message = payload.message.slice(0, 2000);
      const path = payload.path.slice(0, 500);
      const method = payload.method.slice(0, 20);
      const fingerprint = generateFingerprint(message, path, method);

      const existing = await this.errorLogRepo.findOne({
        where: { fingerprint },
      });

      if (existing) {
        // Backend errors always escalate to CRITICAL on every repeat
        await this.errorLogRepo.update(existing.id, {
          occurrences: existing.occurrences + 1,
          lastSeenAt: new Date(),
          severity: ErrorSeverity.CRITICAL,
        });
        return;
      }

      await this.save({
        ...payload,
        message,
        path,
        method,
        fingerprint,
      });
    } catch (error) {
      this.logger.warn(
        'createFromBackend failed (ignored) — error_logs table may not exist yet',
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  // ── Public: GET /error-logs ────────────────────────────────────────────────

  async findAll(filters: GetErrorLogsDto): Promise<{
    data: ErrorLog[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    const where: FindOptionsWhere<ErrorLog> = {};

    if (filters.severity) where.severity = filters.severity;
    if (filters.userId) where.userId = filters.userId;
    if (filters.shopId) where.shopId = filters.shopId;

    if (filters.from && filters.to) {
      (where as any).createdAt = Between(
        new Date(filters.from),
        new Date(filters.to),
      );
    } else if (filters.from) {
      (where as any).createdAt = MoreThanOrEqual(new Date(filters.from));
    } else if (filters.to) {
      (where as any).createdAt = LessThanOrEqual(new Date(filters.to));
    }

    const page = filters.page ?? 1;
    const limit = filters.limit ?? 20;

    const [data, total] = await this.errorLogRepo.findAndCount({
      where,
      order: { lastSeenAt: 'DESC', createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      data,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  // ── Public: GET /error-logs/stats ─────────────────────────────────────────

  async getStats(): Promise<{
    total: number;
    topErrors: ErrorLog[];
    bySeverity: { severity: string; count: number }[];
  }> {
    const total = await this.errorLogRepo.count();

    const topErrors = await this.errorLogRepo.find({
      order: { occurrences: 'DESC' },
      take: 5,
    });

    const rawBySeverity = await this.errorLogRepo
      .createQueryBuilder('e')
      .select('e.severity', 'severity')
      .addSelect('COUNT(*)', 'count')
      .groupBy('e.severity')
      .getRawMany<{ severity: string; count: string }>();

    return {
      total,
      topErrors,
      bySeverity: rawBySeverity.map((row) => ({
        severity: row.severity,
        count: Number(row.count),
      })),
    };
  }

  // ── Private ────────────────────────────────────────────────────────────────

  private async save(
    payload: InternalErrorLogPayload & { fingerprint: string },
  ): Promise<void> {
    const log = this.errorLogRepo.create({
      message: payload.message.slice(0, 2000),
      stack: payload.stack?.slice(0, 10_000) ?? null,
      context: payload.context ?? null,
      userId: payload.userId ?? null,
      shopId: payload.shopId ?? null,
      path: payload.path.slice(0, 500),
      method: payload.method.slice(0, 20),
      severity: payload.severity ?? ErrorSeverity.MEDIUM,
      source: payload.source,
      fingerprint: payload.fingerprint,
      occurrences: 1,
      lastSeenAt: new Date(),
    });

    // Any DB error here is re-thrown so callers (createFromDto / createFromBackend)
    // can catch it in their own try/catch and suppress it safely.
    await this.errorLogRepo.save(log);
  }
}
