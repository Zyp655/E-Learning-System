'use client';

import { create } from 'zustand';

export interface LessonNoteItem {
  id: number;
  lessonId: number;
  videoTimestampSec: number;
  content: string;
  createdAt: string;
}

interface LearnState {
  /** Lesson the playback state belongs to; the demo state below is for lesson 101. */
  currentLessonId: number;
  currentTimeSec: number;
  maxWatchedSec: number;
  isPlaying: boolean;
  playbackSpeed: number;
  seekTargetSec: number | null;
  antiSkipNotice: string | null;
  notes: LessonNoteItem[];
  activeSegmentQuizId: number | null;
  segmentAttempts: Record<number, number>; // segmentId -> consecutive wrong attempts
  passedSegments: Record<number, boolean>;
  verifyWatchingModalOpen: boolean;

  /** Starts a different lesson from 0:00 with nothing watched yet; no-op for the current lesson. */
  startLesson: (lessonId: number) => void;
  setCurrentTimeSec: (sec: number) => void;
  setIsPlaying: (playing: boolean) => void;
  setPlaybackSpeed: (speed: number) => void;
  requestSeek: (sec: number, allowBypassAntiSkip?: boolean) => void;
  clearSeekTarget: () => void;
  clearAntiSkipNotice: () => void;
  addNote: (lessonId: number, sec: number, content: string) => void;
  deleteNote: (id: number) => void;
  openSegmentQuiz: (segmentId: number) => void;
  closeSegmentQuiz: () => void;
  recordSegmentQuizAttempt: (segmentId: number, passed: boolean, startTimestamp: number) => {
    mustRewind: boolean;
    attemptCount: number;
  };
  setVerifyWatchingModalOpen: (open: boolean) => void;
}

export const useLearnStore = create<LearnState>((set, get) => ({
  currentLessonId: 101,
  currentTimeSec: 215,
  maxWatchedSec: 650,
  isPlaying: false,
  playbackSpeed: 1.0,
  seekTargetSec: null,
  antiSkipNotice: null,
  notes: [
    {
      id: 1,
      lessonId: 101,
      videoTimestampSec: 225,
      content:
        'Công thức Eye-Lock: EAR > 0.22 kết hợp phương sai Var(EAR) < 0.002 và Nose Drift < 3.5px => nhân hệ số khuếch đại bối rối gazeBoost = 1.6.',
      createdAt: 'Hôm nay',
    },
    {
      id: 2,
      lessonId: 101,
      videoTimestampSec: 550,
      content:
        'Tầng Temporal Attention dùng tanh(W_h * h_t) nhân với vector ngữ cảnh v^T rồi chuẩn hóa Softmax để tìm khung hình nhíu mày rõ nhất.',
      createdAt: 'Hôm nay',
    },
  ],
  activeSegmentQuizId: null,
  segmentAttempts: {},
  passedSegments: { 1001: true },
  verifyWatchingModalOpen: false,

  startLesson: (lessonId) => {
    if (get().currentLessonId === lessonId) return;
    set({
      currentLessonId: lessonId,
      currentTimeSec: 0,
      maxWatchedSec: 0,
      isPlaying: false,
      seekTargetSec: null,
      antiSkipNotice: null,
      activeSegmentQuizId: null,
    });
  },

  setCurrentTimeSec: (sec) =>
    set((s) => ({
      currentTimeSec: sec,
      maxWatchedSec: Math.max(s.maxWatchedSec, sec),
    })),

  setIsPlaying: (playing) => set({ isPlaying: playing }),
  setPlaybackSpeed: (speed) => set({ playbackSpeed: speed }),

  requestSeek: (sec, allowBypassAntiSkip = false) => {
    const state = get();
    if (!allowBypassAntiSkip && sec > state.maxWatchedSec + 15) {
      set({
        antiSkipNotice: `Chống tua vượt (Anti-Skip Guard): Bạn chỉ có thể tua tối đa đến mốc đã xem (${Math.floor(
          state.maxWatchedSec / 60,
        )
          .toString()
          .padStart(2, '0')}:${Math.floor(state.maxWatchedSec % 60)
          .toString()
          .padStart(2, '0')}) để đảm bảo chuẩn Điểm danh AI.`,
      });
      return;
    }
    set({
      currentTimeSec: sec,
      seekTargetSec: sec,
      maxWatchedSec: Math.max(state.maxWatchedSec, sec),
      antiSkipNotice: null,
    });
  },

  clearSeekTarget: () => set({ seekTargetSec: null }),
  clearAntiSkipNotice: () => set({ antiSkipNotice: null }),

  addNote: (lessonId, sec, content) =>
    set((s) => ({
      notes: [
        {
          id: Date.now(),
          lessonId,
          videoTimestampSec: sec,
          content,
          createdAt: 'Vừa xong',
        },
        ...s.notes,
      ],
    })),

  deleteNote: (id) => set((s) => ({ notes: s.notes.filter((n) => n.id !== id) })),

  openSegmentQuiz: (segmentId) => set({ activeSegmentQuizId: segmentId, isPlaying: false }),
  closeSegmentQuiz: () => set({ activeSegmentQuizId: null }),

  recordSegmentQuizAttempt: (segmentId, passed, startTimestamp) => {
    const state = get();
    if (passed) {
      set({
        passedSegments: { ...state.passedSegments, [segmentId]: true },
        segmentAttempts: { ...state.segmentAttempts, [segmentId]: 0 },
        activeSegmentQuizId: null,
      });
      return { mustRewind: false, attemptCount: 0 };
    }

    const nextCount = (state.segmentAttempts[segmentId] || 0) + 1;
    if (nextCount >= 3) {
      // Mandatory rewind to segment.startTimestamp on 3rd consecutive wrong attempt
      set({
        segmentAttempts: { ...state.segmentAttempts, [segmentId]: 0 },
        activeSegmentQuizId: null,
        currentTimeSec: startTimestamp,
        seekTargetSec: startTimestamp,
      });
      return { mustRewind: true, attemptCount: 3 };
    }

    set({
      segmentAttempts: { ...state.segmentAttempts, [segmentId]: nextCount },
    });
    return { mustRewind: false, attemptCount: nextCount };
  },

  setVerifyWatchingModalOpen: (open) =>
    set({ verifyWatchingModalOpen: open, isPlaying: open ? false : get().isPlaying }),
}));
