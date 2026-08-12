/**
 * src/ai/useStreamingChat.ts
 * -----------------------------------------------------------------------
 * Robust hook for existing chatbot drawer. Handles session id, streaming
 * token-by-token rendering, error boundaries, client-side timeouts,
 * and retry affordances.
 */

import { useCallback, useRef, useState } from 'react';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  isError?: boolean;
}

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

export function useStreamingChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [errorState, setErrorState] = useState<string | null>(null);
  const sessionIdRef = useRef<string>(
    typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : String(Date.now())
  );

  const sendMessage = useCallback(async (text: string, attachedFile?: { name: string; extractedText: string }) => {
    if (isStreaming) return;

    setErrorState(null);
    const userMsg: ChatMessage = { role: 'user', content: text, timestamp: new Date().toISOString() };
    setMessages(prev => [...prev, userMsg, { role: 'assistant', content: '', timestamp: new Date().toISOString() }]);
    setIsStreaming(true);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 45000); // 45s client-side timeout

    try {
      const res = await fetch(`${API_BASE}/api/chat/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, sessionId: sessionIdRef.current, attachedFile }),
        signal: controller.signal
      });

      if (!res.ok) {
        let errText = 'Failed to connect to server.';
        try {
          const errJson = await res.json();
          if (errJson.error) errText = errJson.error;
        } catch (_) {}
        throw new Error(errText);
      }

      if (!res.body) throw new Error('No stream response body');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const payload = line.slice(6).trim();
          if (payload === '[DONE]') continue;

          try {
            const parsed = JSON.parse(payload);
            if (parsed.error) {
              throw new Error(parsed.error);
            }
            if (parsed.token) {
              setMessages(prev => {
                const next = [...prev];
                const last = next[next.length - 1];
                if (last && last.role === 'assistant') {
                  next[next.length - 1] = {
                    ...last,
                    content: last.content + parsed.token
                  };
                }
                return next;
              });
            }
          } catch (e: any) {
            if (e.message && e.message !== 'Unexpected end of JSON input') {
              throw e;
            }
          }
        }
      }
    } catch (err: any) {
      let errorMsg = err.name === 'AbortError'
        ? 'Request timed out after 45 seconds. Please try again.'
        : (err.message || 'Something went wrong answering that — try again.');

      if (
        errorMsg.includes('429') ||
        errorMsg.includes('Quota exceeded') ||
        errorMsg.includes('Too Many Requests') ||
        errorMsg.includes('rate_limit')
      ) {
        errorMsg = '⚠️ **Gemini API Rate Limit Reached**: The free-tier API request quota (20 requests/minute) was temporarily reached. Please wait ~15-20 seconds before resubmitting your question.';
      }

      setErrorState(errorMsg);
      setMessages(prev => {
        const next = [...prev];
        const last = next[next.length - 1];
        if (last && last.role === 'assistant' && !last.content) {
          next[next.length - 1] = {
            ...last,
            content: errorMsg,
            isError: true
          };
        } else if (last && last.role === 'assistant') {
          next.push({
            role: 'assistant',
            content: errorMsg,
            timestamp: new Date().toISOString(),
            isError: true
          });
        }
        return next;
      });
      console.error('[useStreamingChat] error', err);
    } finally {
      clearTimeout(timeoutId);
      setIsStreaming(false);
    }
  }, [isStreaming]);

  const retryLastMessage = useCallback(async () => {
    if (isStreaming) return;
    const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
    if (!lastUserMsg) return;

    // Prune the failed assistant message before retrying
    setMessages(prev => {
      const last = prev[prev.length - 1];
      if (last && last.role === 'assistant' && (last.isError || !last.content)) {
        return prev.slice(0, -2); // Remove user and broken assistant message
      }
      return prev;
    });

    await sendMessage(lastUserMsg.content);
  }, [messages, isStreaming, sendMessage]);

  const clearChat = useCallback(async () => {
    try {
      await fetch(`${API_BASE}/api/chat/clear`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: sessionIdRef.current })
      });
    } catch (e) {
      console.warn('[useStreamingChat] Clear history notice:', e);
    }
    setMessages([]);
    setErrorState(null);
  }, []);

  return { messages, sendMessage, retryLastMessage, clearChat, isStreaming, errorState };
}
