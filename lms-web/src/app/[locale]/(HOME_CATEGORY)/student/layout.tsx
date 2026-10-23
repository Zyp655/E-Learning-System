import type { ReactNode } from 'react';

export default function StudentWorkspaceLayout({ children }: { children: ReactNode }) {
  return (
    <div data-desktop-min-text="" data-mobile-cards="">
      {children}
    </div>
  );
}
