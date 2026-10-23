'use client';

import { create } from 'zustand';

export interface MultiplayerPlayer {
  id: number;
  name: string;
  studentCode: string;
  score: number;
  streak: number;
  isReady: boolean;
  lastAnswerMs?: number;
}

interface QuizRoomState {
  roomCode: string;
  status: 'idle' | 'waiting' | 'playing' | 'finished';
  currentQuestionIndex: number;
  countdownSec: number;
  players: MultiplayerPlayer[];
  joinRoom: (code: string) => void;
  startMatch: () => void;
  submitMultiplayerAnswer: (isCorrect: boolean, timeRemainingSec: number) => void;
  nextMultiplayerQuestion: (totalQuestions: number) => void;
  leaveRoom: () => void;
}

const INITIAL_PLAYERS: MultiplayerPlayer[] = [
  { id: 101, name: 'Nguyễn Minh Hiếu (Bạn)', studentCode: '20215401', score: 0, streak: 0, isReady: true },
  { id: 102, name: 'Lê Hoàng Nam', studentCode: '20215412', score: 0, streak: 0, isReady: true },
  { id: 103, name: 'Phạm Thu Hà', studentCode: '20215439', score: 0, streak: 0, isReady: true },
  { id: 104, name: 'Đặng Quốc Khánh', studentCode: '20215465', score: 0, streak: 0, isReady: true },
];

export const useQuizRoomStore = create<QuizRoomState>((set, get) => ({
  roomCode: 'AI2026',
  status: 'idle',
  currentQuestionIndex: 0,
  countdownSec: 30,
  players: INITIAL_PLAYERS,

  joinRoom: (code) =>
    set({
      roomCode: code.toUpperCase() || 'AI2026',
      status: 'waiting',
      currentQuestionIndex: 0,
      countdownSec: 30,
      players: INITIAL_PLAYERS.map((p) => ({ ...p, score: 0, streak: 0 })),
    }),

  startMatch: () =>
    set({
      status: 'playing',
      currentQuestionIndex: 0,
      countdownSec: 30,
    }),

  submitMultiplayerAnswer: (isCorrect, timeRemainingSec) => {
    const state = get();
    const userGain = isCorrect ? 100 + Math.round(timeRemainingSec * 3) : 0;
    const updated = state.players
      .map((p) => {
        if (p.id === 101) {
          return {
            ...p,
            score: p.score + userGain,
            streak: isCorrect ? p.streak + 1 : 0,
          };
        }
        // Simulate real-time peer answers over WebSocket GameManager
        const peerCorrect = Math.random() > 0.25;
        const peerGain = peerCorrect ? 100 + Math.round(Math.random() * 75) : 0;
        return {
          ...p,
          score: p.score + peerGain,
          streak: peerCorrect ? p.streak + 1 : 0,
        };
      })
      .sort((a, b) => b.score - a.score);

    set({ players: updated });
  },

  nextMultiplayerQuestion: (totalQuestions) => {
    const state = get();
    if (state.currentQuestionIndex + 1 >= totalQuestions) {
      set({ status: 'finished' });
    } else {
      set({
        currentQuestionIndex: state.currentQuestionIndex + 1,
        countdownSec: 30,
      });
    }
  },

  leaveRoom: () => set({ status: 'idle', currentQuestionIndex: 0 }),
}));
