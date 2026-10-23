'use client';

import * as Headless from '@headlessui/react';
import clsx from 'clsx';
import * as React from 'react';
import { cn } from '@/lib/utils';
import { Text } from './text';

const sizes = {
  xs: 'sm:max-w-xs',
  sm: 'sm:max-w-sm',
  md: 'sm:max-w-md',
  lg: 'sm:max-w-lg',
  xl: 'sm:max-w-xl',
  '2xl': 'sm:max-w-2xl',
  '3xl': 'sm:max-w-3xl',
  '4xl': 'sm:max-w-4xl',
  '5xl': 'sm:max-w-5xl',
};

const DialogPanelContext = React.createContext<HTMLElement | null>(null);
export const useDialogPortalContainer = () => React.useContext(DialogPanelContext) ?? undefined;

export function Dialog({
  size = 'lg',
  className,
  children,
  scrollLock = false,
  mobileSheet = true,
  panelProps,
  onClose,
  ...props
}: {
  size?: keyof typeof sizes | null;
  className?: string;
  children: React.ReactNode;
  scrollLock?: boolean;
  mobileSheet?: boolean;
  panelProps?: Omit<React.HTMLAttributes<HTMLDivElement>, 'className' | 'children'>;
} & Omit<Headless.DialogProps, 'as' | 'className'>) {
  const [panel, setPanel] = React.useState<HTMLElement | null>(null);
  return (
    <Headless.Dialog {...props} onClose={onClose}>
      <Headless.DialogBackdrop
        transition
        className="fixed inset-0 z-100 bg-gray-950/40 transition duration-150 focus:outline-0 data-closed:opacity-0 data-enter:ease-out data-leave:ease-in"
      />

      <div className={`fixed inset-0 z-100 w-full overflow-x-hidden pt-6 sm:pt-0 ${scrollLock ? 'overflow-hidden' : 'overflow-y-auto'}`}>
        <div className="flex h-full flex-col items-center px-2 py-4 before:flex-1 after:flex-1 sm:px-4 sm:after:flex-2">
          <Headless.DialogPanel
            transition
            ref={setPanel}
            data-mobile-sheet={mobileSheet ? '' : undefined}
            {...panelProps}
            className={cn(
              'relative max-h-none w-full min-w-0 shrink-0 overflow-hidden rounded-3xl bg-white p-5 text-primary shadow-lg ring-1 ring-line forced-colors:outline',
              size ? sizes[size] : null,
              scrollLock && 'flex flex-col',
              'transition duration-150 data-closed:opacity-0 data-enter:ease-out data-leave:ease-in sm:data-closed:translate-y-0 sm:data-closed:data-enter:scale-95',
              className,
            )}
          >
            <DialogPanelContext.Provider value={panel}>{children}</DialogPanelContext.Provider>
          </Headless.DialogPanel>
        </div>
      </div>
    </Headless.Dialog>
  );
}

export function DialogTitle({
  className,
  ...props
}: { className?: string } & Omit<Headless.DialogTitleProps, 'as' | 'className'>) {
  return (
    <Headless.DialogTitle
      {...props}
      className={clsx(className, 'text-lg/6 font-semibold text-balance text-primary')}
    />
  );
}

export function DialogDescription({
  className,
  ...props
}: { className?: string } & Omit<Headless.DescriptionProps<typeof Text>, 'as' | 'className'>) {
  return (
    <Headless.Description as={Text} {...props} className={clsx(className, 'mt-2 text-pretty')} />
  );
}

export function DialogBody({ className, ...props }: React.ComponentPropsWithoutRef<'div'>) {
  return <div {...props} className={clsx(className, 'mt-5')} />;
}

export function DialogActions({ className, ...props }: React.ComponentPropsWithoutRef<'div'>) {
  return (
    <div
      {...props}
      className={clsx(
        className,
        'mt-6 flex flex-col-reverse items-center justify-end gap-3 *:w-full sm:flex-row sm:*:w-auto',
      )}
    />
  );
}
