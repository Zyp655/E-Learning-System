import type { Metadata } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import type { ReactNode } from 'react';
import '@/styles/globals.css';

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin', 'vietnamese'],
  weight: ['400', '500', '600'],
  variable: '--font-jakarta',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'ALARMM LMS — Nhận diện Bối rối Thị giác Máy tính & Trợ lý AI Giải thích Đa phương thức',
  description:
    'Hệ thống Quản lý Học tập Thông minh tích hợp MediaPipe 478 Landmarks, MobileFaceNet 192-d, Multimodal MLP 12 đặc trưng và Trợ lý AI RAG 3 tầng.',
};

export default async function LocaleLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  return (
    <html lang={locale || 'vi'} className={jakarta.variable}>
      <body className="min-h-dvh bg-muted font-sans text-primary antialiased">{children}</body>
    </html>
  );
}
