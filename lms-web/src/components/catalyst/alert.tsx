'use client';

import * as Headless from '@headlessui/react';
import clsx from 'clsx';
import type React from 'react';
import { Dialog } from './dialog';
import { Text } from './text';

export function Alert({
  size = 'md',
  className,
  children,
  ...props
}: React.ComponentProps<typeof Dialog>) {
  return (
    <Dialog size={size} className={className} {...props}>
      {children}
    </Dialog>
  );
}

export function AlertTitle({
  className,
  ...props
}: { className?: string } & Omit<Headless.DialogTitleProps, 'as' | 'className'>) {
  return (
    <Headless.DialogTitle
      {...props}
      className={clsx(
        className,
        'text-center text-base/6 font-semibold text-balance text-primary sm:text-left',
      )}
    />
  );
}

export function AlertDescription({
  className,
  ...props
}: { className?: string } & Omit<Headless.DescriptionProps<typeof Text>, 'as' | 'className'>) {
  return (
    <Headless.Description
      as={Text}
      {...props}
      className={clsx(className, 'mt-2 text-center text-pretty sm:text-left')}
    />
  );
}

export function AlertBody({ className, ...props }: React.ComponentPropsWithoutRef<'div'>) {
  return <div {...props} className={clsx(className, 'mt-4')} />;
}

export function AlertActions({ className, ...props }: React.ComponentPropsWithoutRef<'div'>) {
  return (
    <div
      {...props}
      className={clsx(
        className,
        'mt-6 flex flex-col-reverse items-center justify-end gap-3 *:w-full sm:mt-4 sm:flex-row sm:*:w-auto',
      )}
    />
  );
}
