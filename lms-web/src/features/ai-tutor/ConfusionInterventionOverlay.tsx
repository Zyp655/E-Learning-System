'use client';

import React from 'react';
import { Icon } from '@/app/[locale]/(HOME_CATEGORY)/_components/primitives';
import {
  Badge,
  Button,
  chipVariants,
} from '@/app/[locale]/(HOME_CATEGORY)/_components/ui';
import {
  Dialog,
  DialogActions,
  DialogBody,
  DialogDescription,
  DialogTitle,
} from '@/components/catalyst/dialog';
import { formatSeconds } from '@/lib/utils';
import { useConfusionStore } from '@/store/useConfusionStore';
import { useLearnStore } from '@/store/useLearnStore';
import { useTutorStore } from '@/store/useTutorStore';

interface ConfusionInterventionOverlayProps {
  lessonId: number;
  onFocusTutorTab?: () => void;
}

const TIER_LABELS: Record<string, string> = {
  vector_semantic: 'Tầng 1: pgvector Cosine Semantic RAG (1536 chiều)',
  timestamp_match: 'Tầng 2: Khớp Phân đoạn Thời gian VideoSegments',
  transcript_slice: 'Tầng 3: Trích xuất Phụ đề lân cận (±45 giây)',
};

export function ConfusionInterventionOverlay({
  lessonId,
  onFocusTutorTab,
}: ConfusionInterventionOverlayProps) {
  const {
    activeIntervention,
    interventionOpen,
    interventionLoading,
    ruleScore,
    mlProb,
    eyeLocked,
    gazeBoost,
    closeIntervention,
  } = useConfusionStore();

  const { requestSeek, currentTimeSec } = useLearnStore();
  const { sendMessage } = useTutorStore();

  const handleSelectFollowUpChip = async (questionChip: string) => {
    closeIntervention('helpful');
    if (onFocusTutorTab) onFocusTutorTab();
    await sendMessage(
      questionChip,
      lessonId,
      activeIntervention?.timestampSec ?? currentTimeSec,
    );
  };

  return (
    <Dialog open={interventionOpen} onClose={() => closeIntervention('dismissed')} size="lg">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-chat-subtle text-chat">
            <Icon name="sparkles" size="sm" />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <Badge variant="chat">Can thiệp Sư phạm Chủ động (Proactive AI Intervention)</Badge>
              {eyeLocked && <Badge variant="warning">Eye-Lock x{gazeBoost.toFixed(1)}</Badge>}
            </div>
            <p className="mt-0.5 text-xs text-secondary">
              Hybrid Score: {ruleScore}/100 · MLP Prob: {Math.round(mlProb * 100)}% · Cooldown chống làm phiền: 5 phút
            </p>
          </div>
        </div>

        {activeIntervention && (
          <Badge variant="info">
            {TIER_LABELS[activeIntervention.retrievalTier] || activeIntervention.retrievalTier}
          </Badge>
        )}
      </div>

      <DialogTitle className="mt-3">
        {interventionLoading
          ? 'Trợ lý AI đang truy hồi ngữ cảnh bài giảng (pgvector RAG)...'
          : activeIntervention?.segmentTitle || 'Giải thích Nhanh Phân đoạn Đang Học'}
      </DialogTitle>
      <DialogDescription>
        Hệ thống phát hiện bạn đang dừng lại hoặc nhíu mày tập trung cao độ tại mốc{' '}
        <strong className="font-semibold text-primary">
          {formatSeconds(activeIntervention?.timestampSec ?? currentTimeSec)}
        </strong>
        . Dưới đây là tóm tắt cô đọng và ví dụ trực quan phù hợp với chuyên ngành của bạn:
      </DialogDescription>

      <DialogBody className="space-y-4">
        {interventionLoading || !activeIntervention ? (
          <div className="rounded-xl bg-muted p-6 text-center text-sm text-secondary">
            Đang tổng hợp lời giải thích theo Hồ sơ Học vụ Sinh viên và ngữ cảnh phân đoạn...
          </div>
        ) : (
          <>
            {/* 1. Core Summary */}
            <div className="rounded-xl bg-muted p-4 space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-chat">
                <Icon name="bookOpen" size="xs" />
                <span>Tóm tắt cốt lõi tại mốc {formatSeconds(activeIntervention.timestampSec)}</span>
              </div>
              <p className="text-sm leading-relaxed text-primary">{activeIntervention.summary}</p>
            </div>

            {/* 2. Domain-personalized Analogy */}
            <div className="rounded-xl bg-chat-subtle p-4 space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-chat">
                <Icon name="lightBulb" size="xs" />
                <span>Ví dụ Liên hệ Thực tế (Cá nhân hóa theo chuyên ngành KHMT & AI)</span>
              </div>
              <p className="text-sm leading-relaxed text-primary">{activeIntervention.analogy}</p>
            </div>

            {/* 3. Clickable Follow-up Question Chips */}
            <div className="space-y-2">
              <span className="block text-xs font-semibold text-primary">
                Chọn nhanh một câu hỏi để đào sâu cùng Trợ lý AI:
              </span>
              <div className="flex flex-wrap gap-2">
                {activeIntervention.contentPoints.map((pt, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSelectFollowUpChip(pt)}
                    className={chipVariants({ variant: 'subtle', size: 'sm' })}
                  >
                    <Icon name="chatBubble" size="xs" className="text-chat" />
                    {pt}
                  </button>
                ))}
              </div>
            </div>

            {/* 4. Related Video Timestamp Citations */}
            {activeIntervention.relatedTimestamps.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <span className="text-xs text-secondary">Tua nhanh tới mốc liên quan:</span>
                {activeIntervention.relatedTimestamps.map((ts, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      requestSeek(ts.sec, true);
                      closeIntervention('helpful');
                    }}
                    className={chipVariants({ variant: 'default', size: 'xs' })}
                  >
                    <Icon name="play" size="xs" />[{ts.label}] ({formatSeconds(ts.sec)})
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </DialogBody>

      <DialogActions>
        <Button variant="ghost" onClick={() => closeIntervention('not_helpful')}>
          Đóng (Tôi vẫn ổn)
        </Button>
        <Button
          variant="chat"
          onClick={() => {
            closeIntervention('helpful');
            if (onFocusTutorTab) onFocusTutorTab();
          }}
        >
          <Icon name="checkCircle" size="sm" />
          Đã hiểu rõ (+1 Phiên giải tỏa bối rối)
        </Button>
      </DialogActions>
    </Dialog>
  );
}
