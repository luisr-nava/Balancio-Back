import { countries } from 'country-data';

export function getCurrenciesForCountry(countryCode: string): string[] {
  const country = countries[countryCode.toUpperCase()];

  if (!country) return [];

  return [...(country.currencies ?? [])];
}
