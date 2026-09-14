import { COUNTRY_LOCALE, DEFAULT_LOCALE } from '@/shop/utils/country-locale';

export function formatCurrency(
  amount: number,
  currency: string,
  countryCode?: string,
): string {
  const locale = countryCode
    ? COUNTRY_LOCALE[countryCode] ?? DEFAULT_LOCALE
    : DEFAULT_LOCALE;

  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
  }).format(amount);
}
