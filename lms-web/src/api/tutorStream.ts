import { ApiError, buildApiUrl, buildAuthHeaders, toHttpError } from './client';

export const TUTOR_STREAM_PATH = '/v1/student/tutor/stream-chat';

/** Request body of POST /v1/student/tutor/stream-chat (service.TutorStreamChatReqBody). */
export interface TutorStreamRequest {
  lessonId: number;
  courseId?: number;
  message: string;
  persona: string;
  videoTimestamp: number;
  imageBase64?: string;
}

export interface TutorStreamMeta {
  persona?: string;
  lessonId?: number;
  videoTimestamp?: number;
  hasVisionFrame?: boolean;
}

export interface TutorStreamDone {
  content: string;
  persona?: string;
  timestamp?: string;
}

export interface TutorStreamHandlers {
  onMeta?: (meta: TutorStreamMeta) => void;
  onToken?: (token: string) => void;
}

export interface SseEvent {
  event: string;
  data: string;
}

/**
 * Incremental Server-Sent Events parser. Chunks may split lines and events anywhere; an event is
 * dispatched on the blank line that terminates it (text/event-stream spec, "event:" and "data:" fields).
 */
export function createSseParser(onEvent: (evt: SseEvent) => void) {
  let buffer = '';
  let eventName = '';
  let dataLines: string[] = [];

  const dispatch = () => {
    if (dataLines.length > 0) onEvent({ event: eventName || 'message', data: dataLines.join('\n') });
    eventName = '';
    dataLines = [];
  };

  const processLine = (line: string) => {
    if (line === '') {
      dispatch();
      return;
    }
    if (line.startsWith(':')) return; // comment / keep-alive
    const idx = line.indexOf(':');
    const field = idx === -1 ? line : line.slice(0, idx);
    let value = idx === -1 ? '' : line.slice(idx + 1);
    if (value.startsWith(' ')) value = value.slice(1);
    if (field === 'event') eventName = value;
    else if (field === 'data') dataLines.push(value);
  };

  return {
    push(chunk: string) {
      buffer += chunk;
      let nl = buffer.search(/\r\n|\r|\n/);
      while (nl !== -1) {
        // A lone trailing \r may be the first half of \r\n: wait for the next chunk.
        if (buffer[nl] === '\r' && nl === buffer.length - 1) break;
        const sepLen = buffer[nl] === '\r' && buffer[nl + 1] === '\n' ? 2 : 1;
        processLine(buffer.slice(0, nl));
        buffer = buffer.slice(nl + sepLen);
        nl = buffer.search(/\r\n|\r|\n/);
      }
    },
    /** Called at end of stream: dispatches a final event that was not followed by a blank line. */
    flush() {
      if (buffer) processLine(buffer.replace(/\r$/, ''));
      buffer = '';
      dispatch();
    },
  };
}

const parseJson = (data: string): Record<string, unknown> => {
  try {
    const v: unknown = JSON.parse(data);
    return v && typeof v === 'object' ? (v as Record<string, unknown>) : {};
  } catch {
    return {};
  }
};

/**
 * Streams an AI Tutor answer over SSE. Tokens are delivered through `handlers.onToken` as they arrive;
 * resolves with the final `done` payload. Throws ApiError when the backend is unreachable (status 0),
 * rejects the request (401 clears the session) or emits an `error` event.
 */
export async function streamTutorChat(
  body: TutorStreamRequest,
  handlers: TutorStreamHandlers = {},
  signal?: AbortSignal,
): Promise<TutorStreamDone> {
  const method = 'POST';
  let res: Response;
  try {
    res = await fetch(buildApiUrl(TUTOR_STREAM_PATH), {
      method,
      headers: buildAuthHeaders({ Accept: 'text/event-stream' }),
      body: JSON.stringify(body),
      signal,
    });
  } catch {
    throw new ApiError({ status: 0, message: 'Không kết nối được AI Tutor.', path: TUTOR_STREAM_PATH, method });
  }

  if (!res.ok) throw await toHttpError(res, TUTOR_STREAM_PATH, method);
  if (!res.body) {
    throw new ApiError({
      status: res.status,
      message: 'AI Tutor không trả về luồng dữ liệu.',
      path: TUTOR_STREAM_PATH,
      method,
    });
  }

  let accumulated = '';
  // Assigned inside the parser callback, so declared without initial-value narrowing.
  let done = null as TutorStreamDone | null;
  let streamError = null as string | null;

  const parser = createSseParser(({ event, data }) => {
    if (done || streamError !== null) return;
    const payload = parseJson(data);
    if (event === 'meta') handlers.onMeta?.(payload as TutorStreamMeta);
    else if (event === 'token') {
      const token = typeof payload.token === 'string' ? payload.token : '';
      if (token) {
        accumulated += token;
        handlers.onToken?.(token);
      }
    } else if (event === 'error') {
      streamError = typeof payload.message === 'string' && payload.message ? payload.message : 'AI Tutor gặp lỗi.';
    } else if (event === 'done') {
      done = {
        content: typeof payload.content === 'string' && payload.content ? payload.content : accumulated,
        persona: typeof payload.persona === 'string' ? payload.persona : undefined,
        timestamp: typeof payload.timestamp === 'string' ? payload.timestamp : undefined,
      };
    }
  });

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  try {
    for (;;) {
      const { value, done: finished } = await reader.read();
      if (finished) break;
      parser.push(decoder.decode(value, { stream: true }));
      if (done || streamError !== null) break;
    }
    if (!done && streamError === null) {
      parser.push(decoder.decode());
      parser.flush();
    }
  } catch {
    if (!done && streamError === null) {
      throw new ApiError({ status: 0, message: 'Kết nối AI Tutor bị gián đoạn.', path: TUTOR_STREAM_PATH, method });
    }
  } finally {
    reader.cancel().catch((): void => undefined);
  }

  if (streamError !== null) {
    throw new ApiError({ status: res.status, message: streamError, path: TUTOR_STREAM_PATH, method });
  }
  if (!done) {
    throw new ApiError({ status: 0, message: 'Kết nối AI Tutor bị gián đoạn.', path: TUTOR_STREAM_PATH, method });
  }
  return done;
}
