import { type ClassValue, clsx } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

// Đăng ký token custom (src/styles/tokens.css) để cn() không nhầm
// text-body / text-h1… là màu chữ rồi xóa nhầm khi gộp class.
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: ['display', 'h1', 'h2', 'h3', 'h4', 'body-lg', 'body', 'caption'],
      container: ['form', 'article', 'page'],
      radius: ['button'],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDuration(minutes: number): string {
  if (!minutes || minutes <= 0) return '0p';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} phút`;
  return m > 0 ? `${h}h ${m}p` : `${h} giờ`;
}

export function formatSeconds(sec: number): string {
  const safe = Math.max(0, Math.floor(sec));
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}
