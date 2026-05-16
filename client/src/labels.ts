import { countryName, getCountry, type Lang } from "@flags/shared";

export function countryLabel(code: string, lang: Lang): string {
  const c = getCountry(code);
  return c ? countryName(c, lang) : code;
}
