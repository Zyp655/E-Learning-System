'use client';

import React from 'react';
import { Icon } from '@/app/[locale]/(HOME_CATEGORY)/_components/primitives';
import { Badge, Button } from '@/app/[locale]/(HOME_CATEGORY)/_components/ui';
import {
  Dialog,
  DialogActions,
  DialogBody,
  DialogDescription,
  DialogTitle,
} from '@/components/catalyst/dialog';
import { useConfusionStore } from '@/store/useConfusionStore';
import { useLearnStore } from '@/store/useLearnStore';

export function FaceVerificationModals() {
  const {
    faceAbsentOverlayOpen,
    identityMismatchOverlayOpen,
    consecutiveNoFaceChecks,
    consecutiveMismatchChecks,
    faceSimilarity,
    resolveBiometricAlert,
  } = useConfusionStore();

  const { setIsPlaying } = useLearnStore();

  const handleResumeAfterVerification = () => {
    resolveBiometricAlert();
    setIsPlaying(true);
  };

  return (
    <>
      {/* 1. FaceAbsenceOverlay: 6 consecutive no_face checks (30 seconds) */}
      <Dialog open={faceAbsentOverlayOpen} onClose={handleResumeAfterVerification} size="md">
        <div className="flex items-center gap-2.5">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-50 text-danger">
            <Icon name="exclamation" size="md" />
          </span>
          <div>
            <DialogTitle>Tạm dừng Bài giảng — Không phát hiện Khuôn mặt (30 giây)</DialogTitle>
            <DialogDescription>
              Hệ thống Giám sát Điểm danh AI đã tạm khóa tiến độ xem video sau {consecutiveNoFaceChecks} lần kiểm tra
              liên tiếp không thấy học viên.
            </DialogDescription>
          </div>
        </div>

        <DialogBody className="space-y-3 text-sm text-secondary">
          <div className="rounded-xl bg-muted p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-primary">Trạng thái phiên học:</span>
              <Badge variant="danger">Đã tạm khóa bộ đếm thời lượng xem</Badge>
            </div>
            <p>
              Để đảm bảo tính minh bạch của <strong>Điểm danh Tự động (≥ 70% thời lượng xem thực tế)</strong>, vui lòng
              ngồi trước camera và nhấn xác nhận bên dưới để tiếp tục bài học.
            </p>
          </div>
        </DialogBody>

        <DialogActions>
          <Button variant="primary" onClick={handleResumeAfterVerification}>
            <Icon name="camera" size="sm" />
            Tôi đã quay lại — Xác thực & Tiếp tục học
          </Button>
        </DialogActions>
      </Dialog>

      {/* 2. IdentityMismatchOverlay: 3 consecutive identity mismatches (15 seconds) */}
      <Dialog open={identityMismatchOverlayOpen} onClose={handleResumeAfterVerification} size="md">
        <div className="flex items-center gap-2.5">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-50 text-danger">
            <Icon name="shield" size="md" />
          </span>
          <div>
            <DialogTitle>Cảnh báo Xác thực Sinh trắc — Khuôn mặt Không khớp (15 giây)</DialogTitle>
            <DialogDescription>
              Độ tương đồng Cosine MobileFaceNet hiện tại ({Math.round(faceSimilarity * 100)}%) thấp hơn ngưỡng chính
              chủ (60%) trong {consecutiveMismatchChecks} chu kỳ liên tiếp.
            </DialogDescription>
          </div>
        </div>

        <DialogBody className="space-y-3 text-sm text-secondary">
          <div className="rounded-xl bg-muted p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-primary">Mã sự kiện ghi nhận:</span>
              <Badge variant="danger">identity_mismatch (Đã lưu nhật ký)</Badge>
            </div>
            <p>
              Vui lòng đảm bảo chỉ một mình học viên đã đăng ký khuôn mặt (<strong>Nguyễn Minh Hiếu · 2021604123</strong>)
              xuất hiện trong khung hình và đủ ánh sáng.
            </p>
          </div>
        </DialogBody>

        <DialogActions>
          <Button variant="primary" onClick={handleResumeAfterVerification}>
            <Icon name="checkCircle" size="sm" />
            Quét lại Khuôn mặt Chính chủ & Tiếp tục
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
