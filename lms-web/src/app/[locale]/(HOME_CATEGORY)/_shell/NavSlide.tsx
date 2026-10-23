'use client';

import { useLayoutEffect, useRef, type ReactNode } from 'react';

export function NavSlide({
  direction,
  children,
}: {
  direction: 'forward' | 'back' | null;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !direction || typeof el.animate !== 'function') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const from = direction === 'forward' ? 40 : -40;
    const animation = el.animate(
      [
        { opacity: 0, transform: `translateX(${from}px)` },
        { opacity: 1, transform: 'none' },
      ],
      { duration: 420, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' },
    );
    return () => animation.cancel();
  }, [direction]);

  return <div ref={ref}>{children}</div>;
}
