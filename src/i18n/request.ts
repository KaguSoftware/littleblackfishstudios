import { getRequestConfig } from 'next-intl/server';

const LOCALES = ['en', 'fa'] as const;
type Locale = (typeof LOCALES)[number];

const isLocale = (value: string | undefined): value is Locale =>
  LOCALES.includes(value as Locale);

export default getRequestConfig(async ({ locale }) => {
  // Fall back to English for an unknown locale
  const activeLocale: Locale = isLocale(locale) ? locale : 'en';

  return {
    locale: activeLocale,
    messages: (await import(`../messages/${activeLocale}.json`)).default
  };
});
