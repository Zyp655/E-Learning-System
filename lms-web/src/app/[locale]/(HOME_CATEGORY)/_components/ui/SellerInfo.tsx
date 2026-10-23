'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { LocaleLink } from '../LocaleLink';
import { Avatar, Icon } from '../primitives';

export interface SellerInfoData {
  name: string;
  avatar?: string;
  avatarSeed?: string;
  department?: string;
  profession?: ReactNode;
  verified?: boolean;
}

const SIZES = {
  sm: { avatar: 'size-8', name: 'text-sm', gap: 'gap-2' },
  md: { avatar: 'size-10', name: 'text-sm', gap: 'gap-2.5' },
  lg: { avatar: 'size-14', name: 'text-base md:text-lg', gap: 'gap-3' },
} as const;

export function SellerInfo({
  seller,
  size = 'md',
  href,
  meta,
  leading,
  trailing,
  hideAvatar = false,
  verifiedLabel = 'Giảng viên đã xác minh',
  className,
}: {
  seller: SellerInfoData;
  size?: keyof typeof SIZES;
  href?: string;
  meta?: ReactNode;
  leading?: ReactNode;
  trailing?: ReactNode;
  hideAvatar?: boolean;
  verifiedLabel?: string;
  className?: string;
}) {
  const s = SIZES[size];
  const sub =
    meta ??
    (leading || seller.department || seller.profession ? (
      <>
        {leading}
        {leading && (seller.department || seller.profession) ? <span aria-hidden="true">·</span> : null}
        {seller.department ? <span className="truncate">{seller.department}</span> : null}
        {seller.department && seller.profession ? <span aria-hidden="true">·</span> : null}
        {seller.profession ? <span className="truncate">{seller.profession}</span> : null}
      </>
    ) : null);

  const body = (
    <>
      {hideAvatar ? null : (
        <Avatar
          src={seller.avatar}
          name={seller.avatarSeed || seller.name}
          className={cn(s.avatar, 'shrink-0 rounded-full bg-subtle')}
        />
      )}
      <span className="min-w-0 flex-1">
        <span className={cn('flex min-w-0 items-center gap-1 leading-tight font-medium text-primary', s.name)}>
          <bdi className={cn('truncate', href && 'group-hover/seller:text-brand')}>{seller.name}</bdi>
          {seller.verified ? (
            <span title={verifiedLabel} className="inline-flex">
              <Icon name="verified" fill size={16} className="text-seller" />
              {verifiedLabel ? <span className="sr-only">{verifiedLabel}</span> : null}
            </span>
          ) : null}
        </span>
        {sub ? (
          <span className="mt-0.5 flex min-w-0 items-center gap-1.5 text-sm leading-tight text-secondary">{sub}</span>
        ) : null}
      </span>
      {trailing}
    </>
  );

  const cls = cn('flex min-w-0 items-center', s.gap, className);
  return href ? (
    <LocaleLink href={href} className={cn('group/seller', cls)}>
      {body}
    </LocaleLink>
  ) : (
    <div className={cls}>{body}</div>
  );
}
