'use client';

import { create } from 'zustand';
import { describeApiError, isApiError } from '@/api/client';
import { streamTutorChat } from '@/api/tutorStream';
import type { TutorMessage, TutorPersona } from '@/api/types';

/** Assistant entries flagged isError explain why no answer was produced (offline, 401, backend error). */
export type TutorChatMessage = TutorMessage & { isError?: boolean };

export const TUTOR_OFFLINE_MESSAGE =
  'AI Tutor đang ngoại tuyến: không kết nối được máy chủ LMS nên chưa có câu trả lời. Vui lòng kiểm tra kết nối rồi gửi lại câu hỏi.';

interface TutorState {
  persona: TutorPersona;
  messages: TutorChatMessage[];
  streamingText: string;
  /** Last failure of sendMessage, cleared by the next successful answer. */
  tutorError: string | null;
  isStreaming: boolean;
  attachedFrameBase64: string | null;
  attachedFrameTimestampSec: number | null;
  voiceModeActive: boolean;
  isRecordingVoice: boolean;
  isPlayingTts: boolean;
  currentTtsSentence: string;
  setPersona: (p: TutorPersona) => void;
  attachVideoFrame: (base64: string | null, timestampSec?: number) => void;
  sendMessage: (question: string, lessonId: number, currentVideoSec: number) => Promise<void>;
  setVoiceModeActive: (active: boolean) => void;
  simulateVoiceQuestion: (lessonId: number, currentVideoSec: number) => Promise<void>;
  clearHistory: () => void;
}

const INITIAL_MESSAGES: TutorChatMessage[] = [
  {
    id: 'welcome_1',
    role: 'assistant',
    persona: 'coach',
    timestamp: 'Vừa xong',
    content:
      'Xin chào **Nguyễn Minh Hiếu** (Chuyên ngành **KHMT & AI · Năm 3**)! Mình là **Trợ lý Ảo Giải thích Nội dung Thông minh**.\n\nMình tự động kết nối với **Truy hồi Ngữ cảnh 3 Tầng (`pgvector` RAG)** của bài giảng hiện tại và có thể:\n- Tự động tóm tắt & giải thích ngay khi hệ thống phát hiện bạn đang bối rối.\n- Đọc **khung hình Slide / Công thức / Code** bạn đính kèm từ video.\n- Trò chuyện theo 3 phong cách: **Gợi mở Socrates**, **Huấn luyện từng bước (Coach)**, hoặc **Giáo sư chuyên sâu (Expert)**.',
    citations: [
      { timeLabel: '03:45', seconds: 225, snippet: 'Chỉ số độ mở mắt EAR & Gaze Stillness' },
      { timeLabel: '09:10', seconds: 550, snippet: 'Cơ chế Temporal Attention trong mạng BiLSTM' },
    ],
    retrievalTier: 'vector_semantic',
  },
];

export const useTutorStore = create<TutorState>((set, get) => ({
  persona: 'coach',
  messages: INITIAL_MESSAGES,
  streamingText: '',
  tutorError: null,
  isStreaming: false,
  attachedFrameBase64: null,
  attachedFrameTimestampSec: null,
  voiceModeActive: false,
  isRecordingVoice: false,
  isPlayingTts: false,
  currentTtsSentence: '',

  setPersona: (persona) => set({ persona }),

  attachVideoFrame: (base64, timestampSec) =>
    set({
      attachedFrameBase64: base64,
      attachedFrameTimestampSec: base64 ? (timestampSec ?? 0) : null,
    }),

  sendMessage: async (question, lessonId, currentVideoSec) => {
    const trimmed = question.trim();
    if (!trimmed || get().isStreaming) return;

    const { persona, attachedFrameBase64, attachedFrameTimestampSec, voiceModeActive } = get();
    const effectiveSec = attachedFrameTimestampSec ?? currentVideoSec;

    const userMsg: TutorMessage = {
      id: `u_${Date.now()}`,
      role: 'user',
      content: trimmed,
      timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
      videoTimestampSec: effectiveSec,
      attachedFrameBase64: attachedFrameBase64 || undefined,
    };

    set((s) => ({
      messages: [...s.messages, userMsg],
      isStreaming: true,
      streamingText: '',
      tutorError: null,
      attachedFrameBase64: null,
      attachedFrameTimestampSec: null,
    }));

    const nowLabel = () => new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    let reply: string;
    try {
      const done = await streamTutorChat(
        {
          lessonId,
          message: trimmed,
          persona,
          videoTimestamp: Math.max(0, Math.round(effectiveSec)),
          ...(attachedFrameBase64 ? { imageBase64: attachedFrameBase64 } : {}),
        },
        { onToken: (token) => set((s) => ({ streamingText: s.streamingText + token })) },
      );
      reply = done.content;
    } catch (err) {
      // No fabricated answer: tell the student exactly why the tutor could not reply.
      const message = isApiError(err) && err.isNetworkError ? TUTOR_OFFLINE_MESSAGE : describeApiError(err);
      set((s) => ({
        messages: [
          ...s.messages,
          {
            id: `e_${Date.now()}`,
            role: 'assistant',
            persona,
            content: message,
            timestamp: nowLabel(),
            videoTimestampSec: effectiveSec,
            isError: true,
          },
        ],
        streamingText: '',
        isStreaming: false,
        tutorError: message,
      }));
      return;
    }

    const assistantMsg: TutorMessage = {
      id: `a_${Date.now()}`,
      role: 'assistant',
      persona,
      content: reply,
      timestamp: nowLabel(),
      videoTimestampSec: effectiveSec,
    };

    set((s) => ({
      messages: [...s.messages, assistantMsg],
      streamingText: '',
      isStreaming: false,
      tutorError: null,
    }));

    if (voiceModeActive && typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
        const sentences = reply
          .replace(/[*#_`]/g, '')
          .split(/[.!?]\s+/)
          .filter((s) => s.trim().length > 10);
        set({ isPlayingTts: true, currentTtsSentence: sentences[0] || '' });
        const utter = new SpeechSynthesisUtterance(sentences.slice(0, 2).join('. '));
        utter.lang = 'vi-VN';
        utter.rate = 1.05;
        utter.onend = () => set({ isPlayingTts: false, currentTtsSentence: '' });
        window.speechSynthesis.speak(utter);
      } catch {
        set({ isPlayingTts: false, currentTtsSentence: '' });
      }
    }
  },

  setVoiceModeActive: (active) => {
    if (!active && typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    set({ voiceModeActive: active, isPlayingTts: false, currentTtsSentence: '' });
  },

  simulateVoiceQuestion: async (lessonId, currentVideoSec) => {
    set({ isRecordingVoice: true });
    await new Promise((r) => setTimeout(r, 1100));
    set({ isRecordingVoice: false, voiceModeActive: true });
    await get().sendMessage(
      'Giải thích giúp mình công thức Temporal Attention alpha_t trên slide đang chiếu và cách cài đặt trong PyTorch?',
      lessonId,
      currentVideoSec,
    );
  },

  clearHistory: () => set({ messages: INITIAL_MESSAGES, streamingText: '', isStreaming: false, tutorError: null }),
}));
