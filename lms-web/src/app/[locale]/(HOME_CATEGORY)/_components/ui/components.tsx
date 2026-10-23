import { LocaleLink } from '../LocaleLink';
import { forwardRef, type ComponentProps, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Icon } from '../primitives';
import {
  badgeVariants,
  buttonVariants,
  cardText,
  cardVariants,
  formClass,
  headingText,
  sectionVariants,
  type ButtonVariantProps,
  type CardVariantProps,
} from './variants';
import type { VariantProps } from 'class-variance-authority';

export const Button = forwardRef<HTMLButtonElement, ComponentProps<'button'> & ButtonVariantProps>(
  function Button({ className, variant, size, block, type = 'button', ...props }, ref) {
    return <button ref={ref} type={type} className={cn(buttonVariants({ variant, size, block }), className)} {...props} />;
  },
);

export function ButtonLink({
  className,
  variant,
  size,
  block,
  ...props
}: ComponentProps<typeof LocaleLink> & ButtonVariantProps) {
  return <LocaleLink className={cn(buttonVariants({ variant, size, block }), className)} {...props} />;
}

export function Card({
  as: Tag = 'div',
  className,
  tone,
  padding,
  interactive,
  media,
  ...props
}: Omit<ComponentProps<'div'>, 'ref'> & CardVariantProps & { as?: 'div' | 'article' | 'section' | 'li' }) {
  return <Tag className={cn(cardVariants({ tone, padding, interactive, media }), className)} {...(props as object)} />;
}

export function Badge({
  tone,
  variant,
  icon,
  className,
  children,
}: VariantProps<typeof badgeVariants> & {
  variant?: VariantProps<typeof badgeVariants>['tone'];
  icon?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span className={cn(badgeVariants({ tone: tone ?? variant }), className)}>
      {icon ? <Icon name={icon} size={14} /> : null}
      {children}
    </span>
  );
}

export function PageHeader({
  title,
  description,
  actions,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn('mb-6 flex flex-wrap items-end justify-between gap-4 md:mb-8', className)}>
      <div className="min-w-0">
        <h1 className={headingText.pageTitle}>{title}</h1>
        {description ? <p className={headingText.pageDesc}>{description}</p> : null}
      </div>
      {actions ? <div className="flex max-w-full shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}

export function Section({
  className,
  spacing,
  tone,
  ...props
}: ComponentProps<'section'> & VariantProps<typeof sectionVariants>) {
  return <section className={cn(sectionVariants({ spacing, tone }), className)} {...props} />;
}

export function FieldLabel({
  children,
  htmlFor,
  required,
  optional,
}: {
  children: ReactNode;
  htmlFor?: string;
  required?: boolean;
  optional?: string;
}) {
  return (
    <label htmlFor={htmlFor} className={formClass.label}>
      {children}
      {required ? <span className={formClass.required}>*</span> : null}
      {optional ? <span className={formClass.optional}>· {optional}</span> : null}
    </label>
  );
}

export function FieldError({ children, id }: { children?: ReactNode; id?: string }) {
  if (!children) return null;
  return (
    <p id={id} role="alert" className={formClass.error}>
      {children}
    </p>
  );
}

export const Input = forwardRef<HTMLInputElement, ComponentProps<'input'> & { compact?: boolean }>(function Input(
  { className, compact, ...props },
  ref,
) {
  return <input ref={ref} className={cn(compact ? formClass.inputSm : formClass.input, className)} {...props} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, ComponentProps<'textarea'>>(function Textarea(
  { className, ...props },
  ref,
) {
  return <textarea ref={ref} className={cn(formClass.textarea, className)} {...props} />;
});

export const Select = forwardRef<HTMLSelectElement, ComponentProps<'select'> & { wrapperClassName?: string }>(
  function Select({ className, wrapperClassName, children, ...props }, ref) {
    return (
      <div className={cn('relative', wrapperClassName)}>
        <select ref={ref} className={cn(formClass.select, className)} {...props}>
          {children}
        </select>
        <Icon
          name="expand_more"
          size={20}
          className="pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 text-secondary"
        />
      </div>
    );
  },
);

export const SearchInput = forwardRef<HTMLInputElement, ComponentProps<'input'> & { wrapperClassName?: string }>(
  function SearchInput({ className, wrapperClassName, type = 'search', ...props }, ref) {
    return (
      <div className={cn('relative', wrapperClassName)}>
        <Icon
          name="search"
          size={20}
          className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-secondary"
        />
        <input ref={ref} type={type} className={cn(formClass.search, className)} {...props} />
      </div>
    );
  },
);

export function EmptyState({
  icon = 'inventory_2',
  title,
  children,
  action,
  bare,
  className,
}: {
  icon?: string | ReactNode;
  title: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  bare?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        !bare && cardVariants({ padding: 'none' }),
        'flex flex-col items-center px-6 py-12 text-center',
        className,
      )}
    >
      <span className="grid size-12 place-items-center rounded-xl bg-muted text-secondary">
        {typeof icon === 'string' ? <Icon name={icon} size={24} /> : icon}
      </span>
      <p className={cn('mt-3', cardText.titleSm)}>{title}</p>
      {children ? <div className={cn('mt-1 max-w-sm', cardText.meta)}>{children}</div> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function LoadError({ message, className }: { message: ReactNode; className?: string }) {
  return (
    <p
      role="alert"
      className={cn('rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800', className)}
    >
      {message}
    </p>
  );
}

export function ProgressBar({
  value,
  tone = 'brand',
  className,
}: {
  value: number;
  tone?: 'brand' | 'seller' | 'chat' | 'success' | 'warning' | 'danger' | 'info';
  className?: string;
}) {
  const clamped = Math.max(0, Math.min(100, Math.round(value)));
  const fillMap: Record<string, string> = {
    brand: 'bg-brand',
    seller: 'bg-seller-600',
    chat: 'bg-chat',
    success: 'bg-success',
    warning: 'bg-amber-500',
    danger: 'bg-danger',
    info: 'bg-blue-600',
  };
  return (
    <div className={cn('h-2 w-full overflow-hidden rounded-full bg-subtle', className)}>
      <div
        className={cn('h-full rounded-full transition-all duration-300', fillMap[tone] || 'bg-brand')}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = 'brand',
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: string;
  tone?: 'brand' | 'seller' | 'chat' | 'success' | 'warning' | 'danger' | 'info';
}) {
  const iconToneMap: Record<string, string> = {
    brand: 'bg-brand-50 text-brand',
    seller: 'bg-seller-50 text-seller-800',
    chat: 'bg-chat-50 text-chat-700',
    success: 'bg-success-50 text-success',
    warning: 'bg-amber-50 text-amber-700',
    danger: 'bg-danger-50 text-danger',
    info: 'bg-info-50 text-blue-700',
  };
  return (
    <Card padding="md" className="flex items-start justify-between gap-3">
      <div className="min-w-0 space-y-1">
        <p className="text-xs font-medium text-secondary uppercase tracking-wide">{label}</p>
        <p className={cardText.stat}>{value}</p>
        {hint ? <p className="text-xs text-secondary">{hint}</p> : null}
      </div>
      {icon ? (
        <span className={cn('grid size-10 shrink-0 place-items-center rounded-xl', iconToneMap[tone] || iconToneMap.brand)}>
          <Icon name={icon} size={20} />
        </span>
      ) : null}
    </Card>
  );
}

