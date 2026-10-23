import type { ReactNode } from 'react';
import { AppShell } from './_shell/AppShell';

export default async function HomeCategoryLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return <AppShell locale={locale || 'vi'}>{children}</AppShell>;
}
