import Image from 'next/image';
import Link from 'next/link';
import { MATERIAL_TO_HERO } from './iconMap';
import { headingText } from './ui/variants';
import { cn } from '@/lib/utils';
import { QuestionMarkCircleIcon } from '@heroicons/react/24/outline';

const BOX_SIZE = /(^|\s)([a-z0-9]+:)*(size|h)-(\d+(\.\d+)?|\[[^\]]+\])(?=\s|$)/;
const TEXT_SIZE = /(^|\s)([a-z0-9]+:)*text-(xs|sm|base|lg|[2-9]?xl|\[[\d.]+(px|rem|em)\])(?=\s|$)/;

const strokeFor = (weight?: number) =>
  weight === undefined ? undefined : weight <= 300 ? 1.25 : weight >= 600 ? 2 : weight >= 500 ? 1.75 : 1.5;

const NAMED_ICON_SIZES: Record<'xs' | 'sm' | 'md' | 'lg', number> = {
  xs: 14,
  sm: 16,
  md: 20,
  lg: 24,
};

export function Icon({
  name,
  className = '',
  fill = false,
  size,
  weight,
}: {
  name: string;
  className?: string;
  fill?: boolean;
  size?: number | 'xs' | 'sm' | 'md' | 'lg';
  weight?: number;
}) {
  const pair = MATERIAL_TO_HERO[name];
  const Svg = pair ? pair[fill ? 1 : 0] : QuestionMarkCircleIcon;
  const resolvedPx = typeof size === 'string' ? NAMED_ICON_SIZES[size] : size;
  const sized = !resolvedPx && BOX_SIZE.test(className);
  const dim = resolvedPx ? `${resolvedPx}px` : TEXT_SIZE.test(className) ? '1em' : '24px';
  const stroke = fill ? undefined : strokeFor(weight);
  return (
    <Svg
      aria-hidden="true"
      className={`inline-block shrink-0 align-[-0.15em] ${className}`}
      style={sized ? undefined : { width: dim, height: dim }}
      {...(stroke ? { strokeWidth: stroke } : {})}
    />
  );
}

const OPTIMIZABLE_IMAGE_HOSTS = new Set([
  'res.cloudinary.com',
  'storage.googleapis.com',
  'lh3.googleusercontent.com',
  'images.unsplash.com',
]);

export function isOptimizableImage(src: string) {
  try {
    return OPTIMIZABLE_IMAGE_HOSTS.has(new URL(src).hostname);
  } catch {
    return false;
  }
}

export function Avatar({ src, name = '', className = '' }: { src?: string; name?: string; className?: string }) {
  if (src) {
    if (isOptimizableImage(src)) {
      return (
        <Image className={`object-cover ${className}`} src={src} alt={name} width={64} height={64} />
      );
    }
    return <img className={`object-cover ${className}`} src={src} alt={name} loading="lazy" />;
  }
  const initial = name.trim().charAt(0).toUpperCase() || '?';
  return (
    <span
      className={`grid place-items-center bg-gray-200 text-xs font-medium text-secondary ${className}`}
      aria-hidden="true"
    >
      {initial}
    </span>
  );
}

export function SectionHeading({
  title,
  desc,
  href,
  actionLabel,
  descMaxW = false,
  descFullWidth = false,
}: {
  title: string;
  desc?: string;
  href?: string;
  actionLabel?: string;
  descMaxW?: boolean;
  descFullWidth?: boolean;
}) {
  return (
    <div>
      {href ? (
        <Link href={href} className="group inline-flex items-center gap-3">
          <h2 className={headingText.sectionTitle}>{title}</h2>
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-subtle text-primary transition-colors group-hover:bg-line">
            {actionLabel ? <span className="sr-only">{actionLabel}</span> : null}
            <Icon name="arrow_forward" size={18} className="transition-transform group-hover:translate-x-0.5" />
          </span>
        </Link>
      ) : (
        <h2 className={headingText.sectionTitle}>{title}</h2>
      )}
      {desc ? (
        <p className={cn(headingText.sectionDesc, descMaxW && 'max-w-xl', descFullWidth && 'max-w-none')}>{desc}</p>
      ) : null}
    </div>
  );
}
