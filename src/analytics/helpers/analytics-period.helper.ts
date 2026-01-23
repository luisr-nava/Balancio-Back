import { BadRequestException } from '@nestjs/common';
import { fromZonedTime } from 'date-fns-tz';

const zonedTimeToUtc = fromZonedTime;
import { AnalyticsPeriod, AnalyticsQueryDto } from '../dto/analytics-query.dto';

export type BucketUnit = 'day' | 'month';

export interface AnalyticsPeriodRange {
  period: AnalyticsPeriod;
  startDate: Date;
  endDate: Date;
  bucketUnit: BucketUnit;
  range: {
    from: string;
    to: string;
  };
}

export function resolveAnalyticsPeriodRange(
  query: AnalyticsQueryDto,
  timezone: string,
  reference = new Date(),
): AnalyticsPeriodRange {
  const resolvedPeriod =
    query.period ??
    (query.year !== undefined ? AnalyticsPeriod.YEAR : AnalyticsPeriod.WEEK);
  let startDate: Date;
  let endDate: Date;
  let bucketUnit: BucketUnit = 'day';

  if (!timezone) {
    timezone = 'UTC';
  }

  const zonedReference = toTimezone(reference, timezone);

  switch (resolvedPeriod) {
    case AnalyticsPeriod.WEEK: {
      const weekStart = getWeekStartFromQuery(query, timezone, zonedReference);
      startDate = startOfWeek(weekStart, timezone);
      endDate = endOfDay(addDays(startDate, 6));
      break;
    }
    case AnalyticsPeriod.MONTH: {
      const monthReference = getMonthReferenceFromQuery(
        query,
        timezone,
        zonedReference,
      );
      startDate = startOfMonth(monthReference, timezone);
      endDate = endOfMonth(monthReference, timezone);
      break;
    }
    case AnalyticsPeriod.YEAR: {
      const yearReference = getYearReferenceFromQuery(
        query,
        timezone,
        zonedReference,
      );
      startDate = startOfYear(yearReference, timezone);
      endDate = endOfYear(yearReference, timezone);
      bucketUnit = 'month';
      break;
    }
    case AnalyticsPeriod.RANGE: {
      if (!query.from || !query.to) {
        throw new BadRequestException(
          'Los parámetros from y to son obligatorios para period range',
        );
      }

      const fromDate = new Date(query.from);
      const toDate = new Date(query.to);

      if (Number.isNaN(fromDate.getTime())) {
        throw new BadRequestException('Fecha de inicio inválida');
      }

      if (Number.isNaN(toDate.getTime())) {
        throw new BadRequestException('Fecha final inválida');
      }

      startDate = startOfDay(fromDate, timezone);
      endDate = endOfDay(toDate, timezone);

      if (startDate > endDate) {
        throw new BadRequestException(
          'El rango debe comenzar antes de finalizar',
        );
      }

      break;
    }
    default:
      throw new BadRequestException('Periodo inválido');
  }

  const range = {
    from: startDate.toISOString(),
    to: endDate.toISOString(),
  };

  return {
    bucketUnit,
    period: resolvedPeriod,
    startDate,
    endDate,
    range,
  };
}

function getWeekStartFromQuery(
  query: AnalyticsQueryDto,
  timezone: string,
  reference: Date,
): Date {
  if (query.week) {
    return getIsoWeekStart(
      query.year ?? reference.getUTCFullYear(),
      query.week,
      timezone,
    );
  }

  return reference;
}

function getMonthReferenceFromQuery(
  query: AnalyticsQueryDto,
  timezone: string,
  reference: Date,
): Date {
  if (query.year !== undefined && query.month !== undefined) {
    const monthPadded = String(query.month).padStart(2, '0');
    return fromZonedTime(`${query.year}-${monthPadded}-01 00:00:00`, timezone);
  }

  return reference;
}

function getYearReferenceFromQuery(
  query: AnalyticsQueryDto,
  timezone: string,
  reference: Date,
): Date {
  const localYear = query.year ?? reference.getUTCFullYear();
  return zonedTimeToUtc(`${localYear}-01-01 00:00:00`, timezone);
}

function getIsoWeekStart(year: number, week: number, timezone: string): Date {
  const januaryFourth = new Date(Date.UTC(year, 0, 4));
  const weekOneStart = startOfWeek(januaryFourth, timezone);
  const result = new Date(weekOneStart);
  result.setUTCDate(result.getUTCDate() + (week - 1) * 7);
  return result;
}

export function startOfWeek(date: Date, timezone: string) {
  const tzDate = toTimezone(date, timezone);
  const day = tzDate.getUTCDay();
  const mondayOffset = (day + 6) % 7;
  const start = new Date(tzDate);
  start.setUTCDate(start.getUTCDate() - mondayOffset);
  return startOfDay(start, timezone);
}

export function endOfWeek(date: Date, timezone: string) {
  const start = startOfWeek(date, timezone);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 6);
  return endOfDay(end, timezone);
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

export function startOfDay(date: Date, timezone = 'UTC') {
  const tzDate = toTimezone(date, timezone);
  return new Date(
    Date.UTC(
      tzDate.getUTCFullYear(),
      tzDate.getUTCMonth(),
      tzDate.getUTCDate(),
      0,
      0,
      0,
      0,
    ),
  );
}

export function endOfDay(date: Date, timezone = 'UTC') {
  const start = startOfDay(date, timezone);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  end.setUTCMilliseconds(end.getUTCMilliseconds() - 1);
  return end;
}

export function startOfMonth(date: Date, timezone = 'UTC') {
  const tzDate = toTimezone(date, timezone);
  return new Date(
    Date.UTC(tzDate.getUTCFullYear(), tzDate.getUTCMonth(), 1, 0, 0, 0, 0),
  );
}

export function endOfMonth(date: Date, timezone = 'UTC') {
  const start = startOfMonth(date, timezone);
  const end = new Date(start);
  end.setUTCMonth(end.getUTCMonth() + 1);
  end.setUTCMilliseconds(end.getUTCMilliseconds() - 1);
  return end;
}

export function startOfYear(date: Date, timezone = 'UTC') {
  const tzDate = toTimezone(date, timezone);
  return new Date(Date.UTC(tzDate.getUTCFullYear(), 0, 1, 0, 0, 0, 0));
}

export function endOfYear(date: Date, timezone = 'UTC') {
  const start = startOfYear(date, timezone);
  const end = new Date(start);
  end.setUTCFullYear(end.getUTCFullYear() + 1);
  end.setUTCMilliseconds(end.getUTCMilliseconds() - 1);
  return end;
}

function toTimezone(date: Date, timezone: string) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const parts = formatter.formatToParts(date);
  const getValue = (type: string) =>
    Number(parts.find((part) => part.type === type)?.value ?? '0');
  const year = getValue('year');
  const month = getValue('month');
  const day = getValue('day');
  const hour = getValue('hour');
  const minute = getValue('minute');
  const second = getValue('second');
  return new Date(Date.UTC(year, month - 1, day, hour, minute, second));
}
