'use client';

import { LocaleLink } from '../_components/LocaleLink';
import { Icon } from '../_components/primitives';
import { isNavActive, type NavItem } from './nav';

const DOT_COLOR = {
  red: 'bg-brand',
  amber: 'bg-amber-500',
  green: 'bg-seller',
} as const;

export function NavMenu({
  items,
  pathname,
  locale,
  teacherMode,
  onNavigate,
}: {
  items: NavItem[];
  pathname: string;
  locale: string;
  teacherMode: boolean;
  onNavigate?: () => void;
}) {
  const activeText = teacherMode ? 'text-seller-800 font-medium' : 'text-brand font-medium';
  const activeBg = teacherMode ? 'bg-seller-50' : 'bg-brand-50/70';
  const hoverRow = teacherMode ? 'hover:bg-seller-50 hover:text-seller-800' : 'hover:bg-muted';

  return (
    <nav className="flex flex-col gap-0.5" aria-label="Điều hướng chính">
      {items.map((item) => {
        const active = isNavActive(pathname, item.path);
        const label = locale === 'en' ? item.labelEn : item.label;
        return (
          <LocaleLink
            key={item.key}
            href={item.path}
            onClick={onNavigate}
            aria-current={active ? 'page' : undefined}
            className={`group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition ${hoverRow} ${
              active ? `${activeBg} ${activeText}` : 'font-normal text-primary'
            }`}
          >
            <Icon
              name={item.icon}
              fill={active}
              size={20}
              className={
                active
                  ? teacherMode
                    ? 'text-seller'
                    : 'text-brand'
                  : `text-secondary ${teacherMode ? 'group-hover:text-seller' : 'group-hover:text-brand'}`
              }
            />
            <span className="min-w-0 flex-1 truncate leading-snug">{label}</span>
            {item.badge ? (
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-xs leading-none font-medium text-white ${
                  teacherMode ? 'bg-seller-600' : 'bg-brand'
                }`}
              >
                {item.badge}
              </span>
            ) : item.dot ? (
              <span className="relative mr-1 grid size-2.5 shrink-0 place-items-center" aria-hidden="true">
                {item.dot === 'red' && (
                  <span className={`absolute inset-0 animate-ping rounded-full ${DOT_COLOR[item.dot]}`} />
                )}
                <span className={`size-2.5 rounded-full ${DOT_COLOR[item.dot]}`} />
              </span>
            ) : null}
          </LocaleLink>
        );
      })}
    </nav>
  );
}
