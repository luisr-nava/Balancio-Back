import { getCurrenciesForCountry } from './country-currency';
import { COUNTRY_TIMEZONE_DEFAULT } from './country-timezone-default';
export function isValidIanaTimezone(timezone: string): boolean {
  try {
    Intl.DateTimeFormat('en-US', { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}

interface NormalizeShopConfigInput {
  countryCode: string;
  currencyCode: string;
}

interface NormalizedShopConfig {
  timezone: string;
  currency: string;
}

export function normalizeShopConfig(
  input: NormalizeShopConfigInput,
): NormalizedShopConfig {
  const countryCode = input.countryCode.toUpperCase();
  const currencyCode = input.currencyCode.toUpperCase();

  // 1️⃣ Timezone
  const timezone = COUNTRY_TIMEZONE_DEFAULT[countryCode] ?? 'UTC';

  if (!isValidIanaTimezone(timezone)) {
    throw new Error(`Invalid timezone for country ${countryCode}`);
  }

  // 2️⃣ Currency validation
  const allowedCurrencies = getCurrenciesForCountry(countryCode);

  if (allowedCurrencies.length === 0) {
    throw new Error(`Unsupported country code: ${countryCode}`);
  }

  return {
    timezone,
    currency: currencyCode,
  };
}
