'use client';

import NextLink from 'next/link';
import { useParams } from 'next/navigation';
import { forwardRef, type ComponentProps } from 'react';
import { allLocalePrefixes, DEFAULT_LOCALE } from '@/i18n/locales';

const PREFIXES = new Set<string>(allLocalePrefixes);

export function withLocale(href: string, locale: string): string {
  if (!href.startsWith('/') || href.startsWith('//')) return href;
  const first = href.split(/[/?#]/)[1] ?? '';
  if (PREFIXES.has(first)) return href;
  return href === '/' ? `/${locale}` : `/${locale}${href}`;
}

export const LocaleLink = forwardRef<HTMLAnchorElement, ComponentProps<typeof NextLink>>(
  function LocaleLink({ href, ...props }, ref) {
    const params = useParams();
    const locale = (params?.locale as string) || DEFAULT_LOCALE;
    const target = typeof href === 'string' ? withLocale(href, locale) : href;
    return <NextLink ref={ref} href={target} {...props} />;
  },
);
