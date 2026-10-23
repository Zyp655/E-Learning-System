/**
 * UI kit của nhóm (HOME_CATEGORY) — công thức class Tailwind dùng chung.
 * Kế thừa 100% từ strongbody-web.
 */
import { cva, type VariantProps } from 'class-variance-authority';

/* ------------------------------------------------------------------ */
/* Button                                                              */
/* ------------------------------------------------------------------ */

export const buttonVariants = cva(
  'inline-flex max-w-full shrink-0 items-center justify-center gap-2 rounded-button text-center leading-tight font-medium break-words transition-colors outline-none select-none focus-visible:ring-4 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        /** Hành động chính phía học sinh (brand đỏ). */
        primary: 'bg-brand text-white hover:bg-brand-800 focus-visible:ring-brand/20',
        /** Hành động chính phía giảng viên / Teacher Studio (seller xanh). */
        seller: 'bg-seller-600 text-white hover:bg-seller-700 focus-visible:ring-seller/20',
        /** Đăng ký tài khoản. */
        signup: 'bg-blue-800 text-white hover:bg-blue-900 focus-visible:ring-blue-800/20',
        /** Hành động chính trong khu Trợ lý Ảo AI & Tin nhắn (xanh chat). */
        chat: 'bg-chat text-white hover:bg-chat-600 focus-visible:ring-chat/20',
        /** Hành động nổi bật nhẹ trong khu Trợ lý Ảo AI & Tin nhắn. */
        'soft-chat': 'border border-chat/20 bg-chat-50 text-chat-700 hover:bg-chat-100 focus-visible:ring-chat/15',
        /** Hành động phụ — viền trung tính. */
        outline:
          'border border-line-strong bg-white text-primary hover:border-primary hover:bg-muted focus-visible:ring-primary/10',
        /** Alias cho hành động phụ trung tính. */
        secondary:
          'border border-line bg-muted text-primary hover:border-line-strong hover:bg-subtle focus-visible:ring-primary/10',
        /** Hành động nổi bật nhẹ phía học sinh. */
        'soft-brand': 'border border-brand/20 bg-brand-50 text-brand hover:bg-brand-100 focus-visible:ring-brand/15',
        /** Hành động nổi bật nhẹ phía giảng viên. */
        'soft-seller':
          'border border-seller/25 bg-seller-50 text-seller-800 hover:bg-seller-100 focus-visible:ring-seller/15',
        /** Nút nền trong suốt (toolbar, Cancel trong dialog). */
        ghost: 'text-primary hover:bg-subtle focus-visible:ring-primary/10',
        /** Hành động phá huỷ (Xoá / Remove / Delete). */
        danger:
          'border border-danger/20 bg-danger-50 text-danger hover:bg-danger hover:text-white focus-visible:ring-danger/15',
        /** Link dạng chữ phía học sinh. */
        link: 'rounded-md text-brand underline-offset-4 hover:underline focus-visible:ring-brand/15',
        /** Link dạng chữ phía giảng viên. */
        'link-seller': 'rounded-md text-seller underline-offset-4 hover:underline focus-visible:ring-seller/15',
        /** Link chữ "xem thêm". */
        more: 'rounded-md text-sm font-medium text-primary hover:text-brand focus-visible:ring-primary/15',
      },
      size: {
        xs: 'min-h-8 px-3 py-1 text-xs',
        sm: 'min-h-9 px-4 py-1.5 text-sm',
        md: 'min-h-11 px-5 py-2 text-sm md:text-base',
        lg: 'min-h-12 px-6 py-2.5 text-base',
        icon: 'size-10 p-0',
        'icon-sm': 'size-8 p-0',
      },
      block: { true: 'w-full' },
    },
    compoundVariants: [
      { variant: 'link', className: 'min-h-0 px-0 py-0 relative after:absolute after:-inset-x-1 after:-inset-y-2.5' },
      { variant: 'link-seller', className: 'min-h-0 px-0 py-0 relative after:absolute after:-inset-x-1 after:-inset-y-2.5' },
      { variant: 'more', className: 'min-h-0 px-0 py-0 text-sm md:text-sm relative after:absolute after:-inset-x-1 after:-inset-y-2.5' },
    ],
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);
export type ButtonVariantProps = VariantProps<typeof buttonVariants>;

/* ------------------------------------------------------------------ */
/* Card                                                                */
/* ------------------------------------------------------------------ */

export const cardVariants = cva('sb-card rounded-2xl border bg-white', {
  variants: {
    tone: {
      default: 'border-line',
      /** Khối nhấn phía giảng viên (Teacher Studio). */
      seller: 'border-seller/20 bg-seller-25',
      /** Khối nhấn Trợ lý Ảo AI & Can thiệp Bối rối. */
      chat: 'border-chat/20 bg-chat-25',
      /** Khối trạng thái chờ / vô hiệu. */
      muted: 'border-line bg-muted',
    },
    padding: {
      none: '',
      sm: 'p-4',
      md: 'p-5',
      lg: 'p-6 md:p-8',
    },
    interactive: { true: 'transition-colors hover:border-line-strong' },
    media: { true: 'flex flex-col overflow-hidden' },
  },
  defaultVariants: { tone: 'default', padding: 'md' },
});
export type CardVariantProps = VariantProps<typeof cardVariants>;

export const cardText = {
  eyebrow: 'text-xs font-medium tracking-wide text-secondary uppercase',
  title: 'text-base leading-snug font-semibold text-primary md:text-lg',
  titleSm: 'text-base leading-snug font-semibold text-primary',
  description: 'text-sm leading-relaxed text-primary',
  meta: 'text-sm leading-normal text-secondary',
  price: 'text-lg leading-none font-semibold tracking-tight text-primary',
  priceStrike: 'text-sm text-secondary line-through',
  footer: 'mt-auto flex flex-wrap items-center justify-between gap-3 border-t border-line-subtle pt-4',
  stat: 'text-2xl leading-none font-semibold tracking-tight text-primary md:text-3xl',
} as const;

/* ------------------------------------------------------------------ */
/* Badge / Chip / Tab                                                  */
/* ------------------------------------------------------------------ */

export const badgeVariants = cva(
  'inline-flex max-w-full shrink-0 items-center gap-1 rounded-2xl px-2.5 py-0.5 text-xs leading-4 font-medium break-words',
  {
    variants: {
      tone: {
        default: 'bg-subtle text-secondary',
        neutral: 'bg-subtle text-secondary',
        brand: 'bg-brand-50 text-brand',
        seller: 'bg-seller-50 text-seller-800',
        chat: 'bg-chat-50 text-chat-700',
        success: 'bg-success-50 text-success',
        warning: 'bg-amber-50 text-amber-700',
        danger: 'bg-danger-50 text-danger',
        info: 'bg-info-50 text-blue-700',
        overlay: 'bg-white/95 text-primary shadow-xs backdrop-blur',
      },
    },
    defaultVariants: { tone: 'neutral' },
  },
);

export const chipVariants = cva(
  'inline-flex max-w-full shrink-0 items-center justify-center gap-1.5 rounded-full border text-center leading-tight font-medium break-words transition-colors outline-none focus-visible:ring-4 focus-visible:ring-primary/10',
  {
    variants: {
      active: {
        false: 'border-line bg-white text-secondary hover:border-line-strong hover:text-primary',
        true: '',
      },
      tone: { brand: '', seller: '', chat: '', neutral: '' },
      variant: {
        default: 'border-line bg-white text-secondary hover:border-line-strong hover:text-primary',
        subtle: 'border-line bg-muted text-primary hover:border-line-strong',
        primary: 'border-brand/25 bg-brand-50 text-brand',
        active: 'border-chat/30 bg-chat-50 text-chat-700',
      },
      size: {
        xs: 'min-h-7 px-2.5 py-1 text-xs',
        sm: 'min-h-8 px-3 py-1 text-xs',
        md: 'min-h-9 px-4 py-1.5 text-sm',
      },
    },
    compoundVariants: [
      { active: true, tone: 'brand', className: 'border-brand/20 bg-brand-50 text-brand' },
      { active: true, tone: 'seller', className: 'border-seller/30 bg-seller-50 text-seller-800' },
      { active: true, tone: 'chat', className: 'border-chat/25 bg-chat-50 text-chat-700' },
      { active: true, tone: 'neutral', className: 'border-primary bg-primary text-white' },
    ],
    defaultVariants: { active: false, tone: 'brand', size: 'md' },
  },
);

const tabBase =
  'inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-lg px-4 text-sm font-medium whitespace-nowrap text-secondary transition-colors outline-none hover:text-primary focus-visible:ring-2 focus-visible:ring-primary/15';

export const segmented = {
  list: 'inline-flex w-fit max-w-full items-center gap-1 overflow-x-auto rounded-xl bg-subtle p-1 [scrollbar-width:none] scroll-fade-x',
  fill: 'h-auto min-h-9 min-w-0 flex-1 py-1.5 text-center leading-tight whitespace-normal',
  tab: `${tabBase} aria-selected:bg-white aria-selected:text-primary aria-selected:shadow-xs aria-[current=page]:bg-white aria-[current=page]:text-primary aria-[current=page]:shadow-xs aria-pressed:bg-white aria-pressed:text-primary aria-pressed:shadow-xs data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-xs`,
} as const;

export const tabVariants = cva(tabBase, {
  variants: { active: { true: 'bg-white text-primary shadow-xs', false: '' } },
  defaultVariants: { active: false },
});

/* ------------------------------------------------------------------ */
/* Heading                                                             */
/* ------------------------------------------------------------------ */

export const headingText = {
  pageTitle: 'text-2xl leading-tight font-semibold tracking-tight text-balance text-primary md:text-3xl',
  pageDesc: 'mt-2 max-w-3xl text-base text-secondary',
  heroTitle: 'text-4xl leading-tight font-semibold tracking-tight text-balance text-primary md:text-4xl',
  heroDesc: 'mt-4 text-base text-secondary',
  sectionTitle: 'text-2xl leading-tight font-semibold tracking-tight text-primary md:text-3xl',
  sectionDesc: 'mt-2 max-w-2xl text-base text-secondary',
  panelTitle: 'text-lg leading-snug font-semibold text-primary',
} as const;

export const sectionVariants = cva('scroll-mt-20', {
  variants: {
    spacing: { md: 'py-8 md:py-12', lg: 'py-12 md:py-16', none: '' },
    tone: { default: '', muted: '', bordered: '' },
  },
  defaultVariants: { spacing: 'md', tone: 'default' },
});

/* ------------------------------------------------------------------ */
/* Form                                                                */
/* ------------------------------------------------------------------ */

const fieldBase =
  // ds-ignore-next-line — border-gray-400/500 chuẩn từ strongbody-web variants.ts
  'w-full min-w-0 rounded-xl border border-line-strong bg-white text-base text-primary outline-none transition placeholder:text-tertiary hover:border-gray-400 focus:border-gray-500 focus:ring-3 focus:ring-primary/6 disabled:cursor-not-allowed disabled:bg-muted disabled:text-secondary aria-[invalid=true]:border-danger aria-[invalid=true]:focus:ring-danger/10';

export const formClass = {
  input: `${fieldBase} h-12 px-4`,
  inputSm: `${fieldBase} h-10 px-3.5 text-base md:text-sm`,
  textarea: `${fieldBase} min-h-32 resize-y px-4 py-3 leading-relaxed`,
  select: `${fieldBase} h-12 cursor-pointer appearance-none pr-10 pl-4`,
  search: `${fieldBase} h-11 rounded-full pr-4 pl-11`,
  trigger: `${fieldBase} flex h-12 items-center justify-between gap-2 px-4 text-left`,
  label: 'mb-1.5 flex items-baseline gap-1.5 text-sm font-medium text-primary',
  required: 'text-danger',
  optional: 'font-normal text-secondary',
  help: 'mb-2 text-sm leading-normal text-secondary',
  error: 'mt-1.5 text-sm text-danger',
  menu: 'z-50 max-h-72 overflow-auto rounded-xl border border-line bg-white p-1 shadow-lg',
  option:
    'flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-primary hover:bg-subtle aria-selected:bg-seller-50 aria-selected:font-semibold aria-selected:text-seller-800 data-[active=true]:bg-subtle',
  checkbox: 'size-4 shrink-0 cursor-pointer rounded accent-seller',
  dropzone:
    'flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-line-strong bg-muted p-6 text-center text-sm text-secondary transition hover:border-seller hover:bg-seller-25',
} as const;
