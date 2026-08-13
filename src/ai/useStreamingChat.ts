/**
 * src/ai/useStreamingChat.ts
 * -----------------------------------------------------------------------
 * Robust hook for chatbot drawer. Handles session id, streaming
 * token-by-token rendering, client fallback engine for Vercel,
 * client-side timeouts, and retry affordances.
 */

import { useCallback, useRef, useState } from 'react';
import type { DealRecord } from '../types/sales';
import { executeClientFallbackAnswer } from './clientFallbackEngine';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  isError?: boolean;
}

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

export function useStreamingChat(records?: DealRecord[]) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [errorState, setErrorState] = useState<string | null>(null);
  const lastUserTextRef = useRef<string>('');
  const lastAttachedFileRef = useRef<{ name: string; extractedText: string } | undefined>(undefined);
  const sessionIdRef = useRef<string>(
    `session-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
  );

  const streamFallbackResponse = useCallback(async (text: string) => {
    const fallbackText = executeClientFallbackAnswer(text, records || []);
    let currentLen = 0;
    const chunkSize = 14;

    await new Promise<void>((resolve) => {
      const interval = setInterval(() => {
        currentLen += chunkSize;
        const chunk = fallbackText.slice(0, currentLen);

        setMessages(prev => {
          const next = [...prev];
          const last = next[next.length - 1];
          if (last && last.role === 'assistant') {
            next[next.length - 1] = {
              ...last,
              content: chunk
            };
          }
          return next;
        });

        if (currentLen >= fallbackText.length) {
          clearInterval(interval);
          resolve();
        }
      }, 16);
    });
  }, [records]);

  const sendMessage = useCallback(async (text: string, attachedFile?: { name: string; extractedText: string }) => {
    if (isStreaming) return;

    setErrorState(null);
    lastUserTextRef.current = text;
    lastAttachedFileRef.current = attachedFile;

    const userMsg: ChatMessage = { role: 'user', content: text, timestamp: new Date().toISOString() };
    setMessages(prev => [...prev, userMsg, { role: 'assistant', content: '', timestamp: new Date().toISOString() }]);
    setIsStreaming(true);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 45000); // 45s client-side timeout
    let receivedTokens = false;

    try {
      const res = await fetch(`${API_BASE}/api/chat/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, sessionId: sessionIdRef.current, attachedFile }),
        signal: controller.signal
      });

      const contentType = res.headers.get('content-type') || '';
      if (!res.ok || contentType.includes('text/html')) {
        throw new Error('SERVER_UNAVAILABLE');
      }

      if (!res.body) throw new Error('SERVER_UNAVAILABLE');

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
              receivedTokens = true;
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

      if (!receivedTokens) {
        throw new Error('SERVER_UNAVAILABLE');
      }
    } catch (err: any) {
      if (
        err.message === 'SERVER_UNAVAILABLE' ||
        err.name === 'TypeError' ||
        err.message?.includes('fetch') ||
        err.message?.includes('Failed to fetch')
      ) {
        console.log('[useStreamingChat] Server endpoint unavailable or HTML returned. Executing high-availability client fallback.');
        await streamFallbackResponse(text);
      } else {
        let errorMsg = err.name === 'AbortError'
          ? 'Request timed out after 45 seconds. Please try again.'
          : (err.message || 'Something went wrong answering that — try again.');

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
          }
          return next;
        });
      }
    } finally {
      clearTimeout(timeoutId);
      setIsStreaming(false);
    }
  }, [isStreaming, streamFallbackResponse]);

  const retryLastMessage = useCallback(() => {
    if (lastUserTextRef.current && !isStreaming) {
      // Remove last failed assistant message if empty or error
      setMessages(prev => {
        const next = [...prev];
        if (next.length > 0 && next[next.length - 1].role === 'assistant') {
          next.pop();
        }
        if (next.length > 0 && next[next.length - 1].role === 'user') {
          next.pop();
        }
        return next;
      });
      sendMessage(lastUserTextRef.current, lastAttachedFileRef.current);
    }
  }, [isStreaming, sendMessage]);

  const clearChat = useCallback(() => {
    setMessages([]);
    setErrorState(null);
    sessionIdRef.current = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : String(Date.now());
  }, []);

  return {
    messages,
    sendMessage,
    retryLastMessage,
    clearChat,
    isStreaming,
    errorState
  };
}
