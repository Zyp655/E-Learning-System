import { ReactNode } from 'react';

/**
 * Container chuẩn của trang — canh giữa + bề rộng cố định + padding ngang.
 */
export function Container({
  children,
  className = '',
  wide = false,
}: {
  children: ReactNode;
  className?: string;
  wide?: boolean;
}) {
  return (
    <div
      // ds-ignore-next-line — Container dùng max-width chuẩn toàn trang của App Shell
      className={`mx-auto w-full ${wide ? 'max-w-[1240px]' : 'max-w-[1400px]'} px-3 md:px-6 [[data-shell-frame]_&]:max-w-none ${className}`}
    >
      {children}
    </div>
  );
}
