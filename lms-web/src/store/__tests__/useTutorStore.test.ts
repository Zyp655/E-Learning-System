import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installLocalStorage, jsonResponse, mockFetch, networkDown, sseResponse } from '@/api/__tests__/testUtils';
import { TUTOR_OFFLINE_MESSAGE, useTutorStore } from '../useTutorStore';

const sse = (event: string, data: unknown) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

beforeEach(() => {
  useTutorStore.getState().clearHistory();
  useTutorStore.setState({ persona: 'socrates', voiceModeActive: false, attachedFrameBase64: null, attachedFrameTimestampSec: null });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('useTutorStore.sendMessage (SSE /v1/student/tutor/stream-chat)', () => {
  it('appends streamed tokens to streamingText as they arrive and stores the final answer', async () => {
    installLocalStorage({ lms_access_token: 'jwt' });
    const snapshots: string[] = [];
    const unsubscribe = useTutorStore.subscribe((s) => {
      if (s.isStreaming && s.streamingText && snapshots[snapshots.length - 1] !== s.streamingText) {
        snapshots.push(s.streamingText);
      }
    });
    const calls = mockFetch(() =>
      sseResponse([
        sse('meta', { persona: 'socrates' }),
        sse('token', { token: 'Theo ' }),
        sse('token', { token: 'bạn, ' }),
        sse('token', { token: 'vì sao?' }),
        sse('done', { content: 'Theo bạn, vì sao?' }),
      ]),
    );
    useTutorStore.getState().attachVideoFrame('data:image/png;base64,AAAA', 61.4);

    await useTutorStore.getState().sendMessage('  Attention là gì?  ', 101, 10);
    unsubscribe();

    expect(calls[0].body).toEqual({
      lessonId: 101,
      message: 'Attention là gì?',
      persona: 'socrates',
      videoTimestamp: 61,
      imageBase64: 'data:image/png;base64,AAAA',
    });
    expect(snapshots).toEqual(['Theo ', 'Theo bạn, ', 'Theo bạn, vì sao?']);

    const s = useTutorStore.getState();
    expect(s.isStreaming).toBe(false);
    expect(s.streamingText).toBe('');
    expect(s.tutorError).toBeNull();
    const last = s.messages[s.messages.length - 1];
    expect(last).toMatchObject({ role: 'assistant', persona: 'socrates', content: 'Theo bạn, vì sao?' });
    expect(last.isError).toBeFalsy();
    expect(s.messages.some((m) => m.content.includes('GPT-4o Vision'))).toBe(false);
  });

  it('shows an explicit offline message instead of a fabricated answer when the backend is unreachable', async () => {
    installLocalStorage();
    mockFetch(networkDown);

    await useTutorStore.getState().sendMessage('Giải thích EAR', 101, 30);

    const s = useTutorStore.getState();
    const last = s.messages[s.messages.length - 1];
    expect(s.isStreaming).toBe(false);
    expect(s.tutorError).toBe(TUTOR_OFFLINE_MESSAGE);
    expect(last).toMatchObject({ role: 'assistant', isError: true, content: TUTOR_OFFLINE_MESSAGE });
    expect(s.messages.filter((m) => m.role === 'assistant' && !m.isError)).toHaveLength(1); // welcome only
  });

  it('surfaces 401 as a sign-in message', async () => {
    installLocalStorage();
    mockFetch(() => jsonResponse(401, { code: 40102, message: 'please provide authorization', data: null }));

    await useTutorStore.getState().sendMessage('Hỏi', 101, 0);

    const s = useTutorStore.getState();
    expect(s.tutorError).toMatch(/đăng nhập/);
    expect(s.messages[s.messages.length - 1].isError).toBe(true);
  });
});
