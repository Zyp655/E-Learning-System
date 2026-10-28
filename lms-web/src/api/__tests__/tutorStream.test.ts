import { afterEach, describe, expect, it, vi } from 'vitest';
import { ACCESS_TOKEN_KEY, ApiError } from '../client';
import { createSseParser, streamTutorChat, type SseEvent } from '../tutorStream';
import { installLocalStorage, jsonResponse, mockFetch, networkDown, sseResponse } from './testUtils';

afterEach(() => {
  vi.unstubAllGlobals();
});

const sse = (event: string, data: unknown) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

describe('createSseParser', () => {
  it('reassembles events split across arbitrary chunk boundaries', () => {
    const events: SseEvent[] = [];
    const parser = createSseParser((e) => events.push(e));
    const raw = sse('meta', { persona: 'coach' }) + sse('token', { token: 'Xin ' }) + sse('token', { token: 'chào' });

    // Feed one character at a time: every line and event boundary is split.
    for (const ch of raw) parser.push(ch);
    parser.flush();

    expect(events).toEqual([
      { event: 'meta', data: '{"persona":"coach"}' },
      { event: 'token', data: '{"token":"Xin "}' },
      { event: 'token', data: '{"token":"chào"}' },
    ]);
  });

  it('handles CRLF line endings split between chunks, comments and multi-line data', () => {
    const events: SseEvent[] = [];
    const parser = createSseParser((e) => events.push(e));
    parser.push(': keep-alive\r');
    parser.push('\nevent: token\r');
    parser.push('\ndata: a\r\ndata: b\r\n\r');
    parser.push('\n');
    parser.push('data: tail');
    parser.flush();

    expect(events).toEqual([
      { event: 'token', data: 'a\nb' },
      { event: 'message', data: 'tail' },
    ]);
  });
});

describe('streamTutorChat', () => {
  const body = { lessonId: 101, message: 'EAR là gì?', persona: 'coach', videoTimestamp: 225 };

  it('posts to /v1/student/tutor/stream-chat with the bearer token and streams tokens until done', async () => {
    installLocalStorage({ [ACCESS_TOKEN_KEY]: 'jwt-9' });
    const raw = sse('meta', { persona: 'coach', lessonId: 101 }) + sse('token', { token: 'EAR ' }) + sse('token', { token: 'đo độ mở mắt' }) + sse('done', { content: 'EAR đo độ mở mắt', persona: 'coach' });
    const calls = mockFetch(() => sseResponse([raw.slice(0, 17), raw.slice(17, 60), raw.slice(60, 61), raw.slice(61)]));

    const tokens: string[] = [];
    const meta = vi.fn();
    const done = await streamTutorChat(body, { onToken: (t) => tokens.push(t), onMeta: meta });

    expect(new URL(calls[0].url).pathname).toBe('/v1/student/tutor/stream-chat');
    expect(calls[0].method).toBe('POST');
    expect(calls[0].headers.Authorization).toBe('Bearer jwt-9');
    expect(calls[0].body).toEqual(body);
    expect(meta).toHaveBeenCalledWith({ persona: 'coach', lessonId: 101 });
    expect(tokens).toEqual(['EAR ', 'đo độ mở mắt']);
    expect(done).toMatchObject({ content: 'EAR đo độ mở mắt', persona: 'coach' });
  });

  it('turns an error event into an ApiError carrying the backend message', async () => {
    installLocalStorage();
    mockFetch(() => sseResponse([sse('meta', {}), sse('token', { token: 'x' }), sse('error', { message: 'OpenAI quota exceeded' })]));
    const err = await streamTutorChat(body).catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.message).toBe('OpenAI quota exceeded');
  });

  it('rejects with 401 (and clears the token) when the backend refuses before streaming', async () => {
    const store = installLocalStorage({ [ACCESS_TOKEN_KEY]: 'expired' });
    mockFetch(() => jsonResponse(401, { code: 40102, message: 'please provide authorization', data: null }));
    await expect(streamTutorChat(body)).rejects.toMatchObject({ status: 401, code: 40102 });
    expect(store.has(ACCESS_TOKEN_KEY)).toBe(false);
  });

  it('reports a network error when the backend is unreachable or the stream ends without done', async () => {
    installLocalStorage();
    mockFetch(networkDown);
    await expect(streamTutorChat(body)).rejects.toMatchObject({ status: 0, isNetworkError: true });

    mockFetch(() => sseResponse([sse('token', { token: 'half' })]));
    await expect(streamTutorChat(body)).rejects.toMatchObject({ isNetworkError: true });
  });
});
