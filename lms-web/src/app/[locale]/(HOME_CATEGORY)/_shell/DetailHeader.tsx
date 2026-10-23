'use client';

import { useRouter } from 'next/navigation';
import { LocaleLink, withLocale } from '../_components/LocaleLink';
import { Icon } from '../_components/primitives';
import { Badge, Button } from '../_components/ui';
import { useConfusionStore } from '@/store/useConfusionStore';

export function DetailHeader({
  title,
  subtitle,
  fallbackHref = '/',
  progressPercent,
  showCameraStatus = false,
  locale = 'vi',
}: {
  title: string;
  subtitle?: string;
  fallbackHref?: string;
  progressPercent?: number;
  showCameraStatus?: boolean;
  locale?: string;
}) {
  const router = useRouter();
  const {
    cameraEnabled,
    currentEmotion,
    isOwnerVerified,
    ruleScore,
    mlProb,
    triggerProactiveIntervention,
  } = useConfusionStore();

  const handleBack = () => {
    router.push(withLocale(fallbackHref, locale));
  };

  const emotionTone =
    currentEmotion === 'confused' || currentEmotion === 'frustrated'
      ? 'danger'
      : currentEmotion === 'bored'
        ? 'warning'
        : 'success';

  const emotionLabelMap: Record<string, string> = {
    focused: 'Đang tập trung (Focused)',
    happy: 'Hứng thú (Happy)',
    confused: 'Đang bối rối (Confused)',
    frustrated: 'Căng thẳng (Frustrated)',
    bored: 'Hơi chán (Bored)',
    neutral: 'Bình thường (Neutral)',
    no_face: 'Không thấy khuôn mặt',
  };

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-50 flex h-16 border-b border-line-subtle bg-white/95 backdrop-blur-md">
        <div className="flex min-w-0 flex-1 items-center gap-2 px-3 md:px-5 lg:gap-3 lg:pr-8 lg:pl-65">
          <button
            type="button"
            onClick={handleBack}
            aria-label="Quay lại"
            className="grid size-10 shrink-0 place-items-center rounded-full text-primary transition hover:bg-muted"
          >
            <Icon name="arrow_back" size={20} />
          </button>

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-primary md:text-base" title={title}>
              {title}
            </p>
            {subtitle ? <p className="truncate text-xs text-secondary">{subtitle}</p> : null}
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {showCameraStatus ? (
              <>
                <Badge tone={cameraEnabled ? emotionTone : 'neutral'} icon="videocam">
                  {cameraEnabled ? emotionLabelMap[currentEmotion] || currentEmotion : 'Camera AI: Tắt'}
                </Badge>
                <Badge
                  tone={isOwnerVerified ? 'seller' : 'danger'}
                  icon="verified_user"
                  className="hidden md:inline-flex"
                >
                  {isOwnerVerified ? 'Khuôn mặt hợp lệ (192-d)' : 'Cảnh báo khuôn mặt'}
                </Badge>
                <Badge tone="info" className="hidden xl:inline-flex">
                  ML: {Math.round(mlProb * 100)}% · Rule: {ruleScore}/100
                </Badge>
                <Button
                  variant="chat"
                  size="sm"
                  onClick={() => triggerProactiveIntervention(101, 550, 'ml_model', true)}
                >
                  <Icon name="sparkles" size={16} />
                  <span className="hidden sm:inline">Giải thích Đoạn này (AI)</span>
                </Button>
              </>
            ) : null}

            {progressPercent !== undefined ? (
              <Badge tone="brand" icon="check_circle">
                Tiến độ: {progressPercent}%
              </Badge>
            ) : null}

            <LocaleLink
              href="/student/dashboard"
              className="hidden rounded-button border border-line-strong bg-white px-3 py-1.5 text-xs font-medium text-primary hover:bg-muted sm:inline-flex"
            >
              Dashboard
            </LocaleLink>
          </div>
        </div>
      </header>
      <div aria-hidden="true" className="h-16 shrink-0" />
    </>
  );
}
