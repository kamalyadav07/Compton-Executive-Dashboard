import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { 
  Bot, 
  Send, 
  X, 
  Sparkles, 
  Mic, 
  MicOff, 
  Volume2,
  VolumeX,
  Trash2,
  Paperclip,
  FileText,
  Zap,
  Radio,
  AlertTriangle
} from 'lucide-react';
import type { DealRecord, KPIMetrics } from '../../types/sales';
import { useStreamingChat } from '../../ai/useStreamingChat';

interface AIChatbotDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  records: DealRecord[];
  kpis: KPIMetrics;
}

// Inline Markdown Parser for bold text (**text**), code (`code`)
const renderInlineMarkdown = (text: string): React.ReactNode => {
  if (!text) return null;
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((part, idx) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={idx} className="font-bold text-slate-100">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code key={idx} className="px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 font-mono text-[11px] border border-blue-500/30">
          {part.slice(1, -1)}
        </code>
      );
    }
    return part;
  });
};

const renderTableCell = (headerName: string, cellValue: string, colIndex: number) => {
  const hLower = (headerName || '').toLowerCase();
  const valLower = (cellValue || '').toLowerCase();

  if (colIndex === 0 || hLower.includes('id')) {
    return (
      <span className="inline-block px-2 py-0.5 rounded-md bg-blue-500/20 border border-blue-400/40 text-blue-300 font-mono text-[11px] font-bold tracking-tight shadow-sm shadow-blue-500/10">
        {cellValue}
      </span>
    );
  }

  if (hLower.includes('value') || hLower.includes('revenue') || cellValue.includes('₹')) {
    return (
      <span className="font-bold text-emerald-400 font-mono text-[11px]">
        {renderInlineMarkdown(cellValue)}
      </span>
    );
  }

  if (hLower.includes('stage')) {
    let pillStyle = 'bg-slate-800 text-slate-300 border-slate-700';
    if (valLower.includes('won')) pillStyle = 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-sm shadow-emerald-500/10';
    else if (valLower.includes('lost')) pillStyle = 'bg-rose-500/20 text-rose-300 border-rose-500/40';
    else pillStyle = 'bg-amber-500/20 text-amber-300 border-amber-500/40';

    return (
      <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold border ${pillStyle}`}>
        {renderInlineMarkdown(cellValue)}
      </span>
    );
  }

  return <span className="text-slate-200 font-sans text-xs">{renderInlineMarkdown(cellValue)}</span>;
};

// Clean Executive Table View Component for Chatbot Messages
const RichTableOrCardView: React.FC<{ headers: string[]; rows: string[][] }> = ({ headers, rows }) => {
  if (rows.length === 0) return null;

  return (
    <div className="my-3.5 overflow-x-auto rounded-xl border border-slate-700/80 bg-slate-950/95 shadow-2xl backdrop-blur-md">
      <table className="w-full text-left text-xs border-collapse">
        <thead className="bg-slate-900/90 text-blue-300 font-extrabold uppercase text-[10px] tracking-wider border-b border-slate-700/80">
          <tr>
            {headers.map((h, i) => (
              <th key={i} className="p-3 whitespace-nowrap">{renderInlineMarkdown(h)}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800/60">
          {rows.map((r, rIdx) => (
            <tr key={rIdx} className="hover:bg-slate-900/70 transition-all duration-150">
              {r.map((cell, cIdx) => (
                <td key={cIdx} className="p-3 text-slate-200 font-medium whitespace-nowrap">
                  {renderTableCell(headers[cIdx] || '', cell, cIdx)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// Rich Executive Markdown & Table Renderer Component
const FormattedMarkdownContent: React.FC<{ content: string }> = ({ content }) => {
  if (!content) return null;

  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];
  let tableRows: string[] = [];
  let inTable = false;

  const flushTable = (keyIndex: number) => {
    if (tableRows.length === 0) return;
    const headerRow = tableRows[0];
    const dataRows = tableRows.slice(1).filter(r => !r.includes('---'));

    const parseCells = (rowStr: string) => 
      rowStr.split('|').map(c => c.trim()).filter((_, idx, arr) => idx > 0 && idx < arr.length - 1);

    const headers = parseCells(headerRow);
    const rows = dataRows.map(parseCells);

    if (headers.length > 0) {
      elements.push(<RichTableOrCardView key={`table-${keyIndex}`} headers={headers} rows={rows} />);
    }
    tableRows = [];
    inTable = false;
  };

  lines.forEach((line, idx) => {
    const trimmed = line.trim();

    // 1. Table Row Detection
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      inTable = true;
      tableRows.push(trimmed);
      return;
    } else if (inTable) {
      flushTable(idx);
    }

    // 2. Horizontal Divider
    if (trimmed === '---' || trimmed === '***') {
      elements.push(<hr key={idx} className="my-3 border-slate-800" />);
      return;
    }

    // 3. Headings
    if (trimmed.startsWith('### ')) {
      elements.push(
        <h4 key={idx} className="text-xs font-black text-blue-400 uppercase tracking-wider mt-4 mb-2 flex items-center gap-1.5 border-b border-slate-800/80 pb-1">
          <Zap className="w-3.5 h-3.5 text-blue-400 shrink-0" />
          <span>{renderInlineMarkdown(trimmed.replace(/^###\s+/, ''))}</span>
        </h4>
      );
      return;
    }
    if (trimmed.startsWith('## ') || trimmed.startsWith('# ')) {
      elements.push(
        <h3 key={idx} className="text-sm font-black text-indigo-300 tracking-wide mt-4 mb-2 border-b border-slate-700/60 pb-1 flex items-center gap-2">
          <span>{renderInlineMarkdown(trimmed.replace(/^#+\s+/, ''))}</span>
        </h3>
      );
      return;
    }

    // 4. Bullet Points (* or - or 1.)
    if (trimmed.startsWith('* ') || trimmed.startsWith('- ') || /^\d+\.\s+/.test(trimmed)) {
      const cleanBulletText = trimmed.replace(/^[\*\-\d\.]+\s+/, '');
      elements.push(
        <div key={idx} className="flex items-start space-x-2.5 py-1 pl-1 text-xs text-slate-200 leading-relaxed">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-1.5 shrink-0 shadow-sm shadow-blue-400/50" />
          <div className="flex-1">{renderInlineMarkdown(cleanBulletText)}</div>
        </div>
      );
      return;
    }

    // 5. Blockquote / Alerts
    if (trimmed.startsWith('> ')) {
      elements.push(
        <blockquote key={idx} className="p-2.5 my-2 rounded-xl bg-amber-500/10 border-l-4 border-amber-500 text-amber-200 text-xs font-medium leading-relaxed">
          {renderInlineMarkdown(trimmed.replace(/^>\s+/, ''))}
        </blockquote>
      );
      return;
    }

    // 6. Regular Paragraphs
    if (trimmed.length > 0) {
      elements.push(
        <p key={idx} className="text-xs text-slate-200 leading-relaxed my-1 font-sans">
          {renderInlineMarkdown(trimmed)}
        </p>
      );
    }
  });

  if (inTable) {
    flushTable(lines.length);
  }

  return <div className="space-y-1 font-sans">{elements}</div>;
};

// Helper: Find Natural Human Female Voice
const getNaturalFemaleVoice = (): SpeechSynthesisVoice | null => {
  if (!('speechSynthesis' in window)) return null;
  const voices = window.speechSynthesis.getVoices();
  if (!voices || voices.length === 0) return null;

  const femaleVoiceNames = [
    'Google US English',
    'Google UK English Female',
    'Microsoft Zira',
    'Microsoft Jenny',
    'Microsoft Aria',
    'Samantha',
    'Victoria',
    'Karen',
    'Fiona',
    'Veena',
    'Moira',
    'en-US-Standard-F',
    'en-US-Wavenet-F'
  ];

  for (const name of femaleVoiceNames) {
    const found = voices.find(v => v.name.toLowerCase().includes(name.toLowerCase()));
    if (found) return found;
  }

  const femaleFallback = voices.find(v => 
    v.name.toLowerCase().includes('female') || 
    v.name.toLowerCase().includes('zira') || 
    v.name.toLowerCase().includes('samantha') || 
    v.name.toLowerCase().includes('karen') ||
    v.name.toLowerCase().includes('victoria') ||
    v.name.toLowerCase().includes('google')
  );

  return femaleFallback || voices[0];
};

// Helper: Clean speech text for natural human voice (no robotic punctuation words)
const prepareTextForNaturalSpeech = (rawText: string): string => {
  if (!rawText) return '';

  let text = rawText;

  // 1. Remove Markdown syntax symbols & tables completely
  text = text.replace(/\|/g, ' ');
  text = text.replace(/--+/g, ' ');
  text = text.replace(/#+/g, ' ');
  text = text.replace(/[*_~`]/g, ' ');

  // 2. Format Deal IDs for natural reading (BITRIX-3742 -> Bitrix deal 37 42)
  text = text.replace(/BITRIX[-_]?(\d+)/gi, (_, digits) => `Bitrix deal ${digits.split('').join(' ')}`);

  // 3. Format Currency (₹7,61,000 -> 7 Lakh 61 Thousand Rupees)
  text = text.replace(/₹\s*([\d,]+(\.\d+)?)/g, (_, val) => {
    const num = parseFloat(val.replace(/,/g, ''));
    if (isNaN(num)) return `${val} rupees`;
    if (num >= 10000000) return `${(num / 10000000).toFixed(2)} Crore Rupees`;
    if (num >= 100000) return `${(num / 100000).toFixed(2)} Lakh Rupees`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)} Thousand Rupees`;
    return `${num} Rupees`;
  });

  // 4. Strip robotic punctuation words like "comma", "fullstop", "colon", "hash"
  text = text.replace(/\b(fullstop|comma|colon|semicolon|dash|underscore|asterisk|hash)\b/gi, '');
  text = text.replace(/[\\/\<\>(){}[\]]/g, ' ');

  // 5. Clean whitespace & extract first ~3-4 key sentences for crisp human voice
  text = text.replace(/\s+/g, ' ').trim();
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
  return sentences.slice(0, 4).join(' ');
};

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

export const AIChatbotDrawer: React.FC<AIChatbotDrawerProps> = ({
  isOpen,
  onClose,
  records: _records,
  kpis: _kpis
}) => {
  const [inputQuery, setInputQuery] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [speechTranscript, setSpeechTranscript] = useState('');
  const [autoSpeak, setAutoSpeak] = useState(true); // Default ON for natural conversation!
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [attachedFile, setAttachedFile] = useState<{ name: string; extractedText: string } | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const latestTranscriptRef = useRef<string>('');
  const prevIsStreamingRef = useRef(false);

  // ── Use the streaming chat hook ───────────────────────────────────
  const { messages: streamMessages, sendMessage, retryLastMessage, clearChat, isStreaming, errorState } = useStreamingChat();

  // Scroll to bottom when messages change
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [streamMessages, isStreaming]);

  // Warm up voices on mount
  useEffect(() => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.onvoiceschanged = () => {
        window.speechSynthesis.getVoices();
      };
    }
    return () => {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // ── Auto-speak when streaming finishes ────────────────────────────
  useEffect(() => {
    if (prevIsStreamingRef.current && !isStreaming && autoSpeak) {
      // Streaming just finished — read the last assistant message aloud
      const lastMsg = streamMessages[streamMessages.length - 1];
      if (lastMsg && lastMsg.role === 'assistant' && lastMsg.content) {
        speakText(lastMsg.content);
      }
    }
    prevIsStreamingRef.current = isStreaming;
  }, [isStreaming, autoSpeak, streamMessages]);

  const handleSend = useCallback(async (queryText?: string) => {
    const textToSend = queryText || inputQuery;
    if ((!textToSend.trim() && !attachedFile) || isStreaming) return;

    const currentFile = attachedFile;
    setInputQuery('');
    setSpeechTranscript('');
    latestTranscriptRef.current = '';
    setAttachedFile(null); // Reset attachment after send

    // Send via streaming hook — pass attached file if present
    await sendMessage(
      textToSend || `Please analyze attached document: ${currentFile?.name}`,
      currentFile || undefined
    );
  }, [inputQuery, attachedFile, isStreaming, sendMessage]);

  // ── File Upload via server-side extraction ─────────────────────────
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset the input so the same file can be re-selected
    e.target.value = '';

    const fileName = file.name;
    const lowerName = fileName.toLowerCase();

    // For PDF, Word, Excel — upload to server for extraction
    if (
      lowerName.endsWith('.pdf') ||
      lowerName.endsWith('.docx') || lowerName.endsWith('.doc') ||
      lowerName.endsWith('.xlsx') || lowerName.endsWith('.xls') || lowerName.endsWith('.csv')
    ) {
      setIsUploading(true);
      try {
        const formData = new FormData();
        formData.append('file', file);
        const res = await fetch(`${API_BASE}/api/chat/upload`, {
          method: 'POST',
          body: formData,
        });
        if (res.ok) {
          const data = await res.json();
          setAttachedFile({ name: data.name, extractedText: data.extractedText });
        } else {
          alert('Failed to process file. Please try again.');
        }
      } catch (err) {
        console.error('File upload error:', err);
        alert('File upload failed. Please try again.');
      } finally {
        setIsUploading(false);
      }
      return;
    }

    // For plain text files — read client-side
    if (lowerName.endsWith('.txt') || lowerName.endsWith('.json')) {
      const reader = new FileReader();
      reader.onload = (evt) => {
        const textContent = evt.target?.result as string || '';
        setAttachedFile({ name: fileName, extractedText: textContent.slice(0, 50000) });
      };
      reader.readAsText(file);
      return;
    }

    // For other files (images etc.) — try server upload as fallback
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(`${API_BASE}/api/chat/upload`, {
        method: 'POST',
        body: formData,
      });
      if (res.ok) {
        const data = await res.json();
        setAttachedFile({ name: data.name, extractedText: data.extractedText });
      } else {
        alert('Unsupported file type.');
      }
    } catch (err) {
      console.error('File upload error:', err);
    } finally {
      setIsUploading(false);
    }
  };

  const handleSpeechInput = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      alert("Speech recognition is not supported in this browser. Please use Chrome, Edge, or Brave.");
      return;
    }

    if (isListening) {
      setIsListening(false);
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = true;
    recognition.continuous = false;

    recognition.onstart = () => {
      setIsListening(true);
      setSpeechTranscript('Listening... Speak your question now');
      latestTranscriptRef.current = '';
    };

    recognition.onresult = (event: any) => {
      let currentTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        currentTranscript += event.results[i][0].transcript;
      }
      setSpeechTranscript(currentTranscript);
      setInputQuery(currentTranscript);
      latestTranscriptRef.current = currentTranscript;
    };

    recognition.onerror = (err: any) => {
      console.error("Speech recognition error:", err);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
      const recognized = latestTranscriptRef.current.trim();
      if (recognized.length > 0) {
        // AUTOMATICALLY SUBMIT RECOGNIZED VOICE QUERY HANDS-FREE!
        handleSend(recognized);
      }
    };

    recognition.start();
  };

  const speakText = (rawMarkdownText: string) => {
    if (!('speechSynthesis' in window)) return;

    window.speechSynthesis.cancel();

    if (isSpeaking) {
      setIsSpeaking(false);
      return;
    }

    const speechContent = prepareTextForNaturalSpeech(rawMarkdownText);
    if (!speechContent) return;

    const utterance = new SpeechSynthesisUtterance(speechContent);
    const femaleVoice = getNaturalFemaleVoice();
    if (femaleVoice) {
      utterance.voice = femaleVoice;
    }

    utterance.rate = 1.0;
    utterance.pitch = 1.1; // Warm human female tone

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    window.speechSynthesis.speak(utterance);
  };

  const stopSpeech = () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
  };

  const handleClearChat = () => {
    if (isSpeaking) stopSpeech();
    clearChat();
  };

  const dynamicQuickQuestions = useMemo(() => {
    const defaultChips = [
      "What is my company sales projection this month?",
      "Which deals are most likely to close in the next 15 days?",
      "List all deals with no updates in the last 10 days",
      "Which sales rep has the highest revenue?",
      "What about this financial year?",
      "List lost deals over ₹5 lakh and why they were lost"
    ];

    if (_records && _records.length > 0) {
      const openDeals = _records.filter(r => r.type === 'in_progress');
      if (openDeals.length > 0) {
        const topDeal = [...openDeals].sort((a, b) => b.grossRevenue - a.grossRevenue)[0];
        if (topDeal) {
          defaultChips[2] = `Deep-dive deal ${topDeal.customer || topDeal.id}`;
        }
      }
    }
    return defaultChips;
  }, [_records]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full max-w-2xl glass-panel border-l border-slate-700/80 shadow-2xl flex flex-col justify-between">
      {/* Header */}
      <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/90 backdrop-blur-md">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-600 flex items-center justify-center shadow-lg shadow-blue-500/25">
            <Bot className="w-5 h-5 text-white animate-pulse" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-1.5">
                AI Deal Partner (Hands-Free Voice)
                <span className="px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-blue-500/20 text-blue-400 border border-blue-500/30">
                  Gemini 2.5 Flash
                </span>
              </h3>
            </div>
            <p className="text-[11px] text-slate-400">Speak naturally — auto-submits &amp; responds out loud</p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {/* Auto Voice Output Toggle */}
          <button
            onClick={() => {
              if (isSpeaking) stopSpeech();
              setAutoSpeak(!autoSpeak);
            }}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold border flex items-center space-x-1.5 transition-all ${
              autoSpeak
                ? 'bg-purple-500/20 text-purple-300 border-purple-500/40 shadow-sm shadow-purple-500/20'
                : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'
            }`}
            title="Auto-speak AI responses out loud"
          >
            {autoSpeak ? <Volume2 className="w-3.5 h-3.5 text-purple-400 animate-bounce" /> : <VolumeX className="w-3.5 h-3.5" />}
            <span>{autoSpeak ? 'Voice ON' : 'Voice OFF'}</span>
          </button>

          {/* Clear Chat */}
          <button
            onClick={handleClearChat}
            className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-800/80 text-slate-400 border border-slate-700 hover:text-rose-400 hover:border-rose-500/40 hover:bg-rose-500/10 flex items-center space-x-1.5 transition-all"
            title="Clear Chat"
          >
            <Trash2 className="w-3.5 h-3.5 text-slate-400 group-hover:text-rose-400" />
            <span>Clear Chat</span>
          </button>

          {/* Close */}
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Quick Action Chips Bar */}
      <div className="p-3 bg-slate-950/60 border-b border-slate-800/80 overflow-x-auto flex space-x-2 scrollbar-none">
        {dynamicQuickQuestions.map((q, idx) => (
          <button
            key={idx}
            onClick={() => handleSend(q)}
            className="px-3 py-1 rounded-full bg-slate-800/90 hover:bg-blue-600/30 hover:border-blue-500/50 text-slate-300 hover:text-blue-300 text-[11px] font-medium whitespace-nowrap border border-slate-700/60 transition-all active:scale-95 shrink-0 flex items-center space-x-1"
          >
            <Zap className="w-3 h-3 text-amber-400" />
            <span>{q}</span>
          </button>
        ))}
      </div>

      {/* Chat Messages Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Welcome message if no messages yet */}
        {streamMessages.length === 0 && (
          <div className="flex flex-col items-start">
            <div className="flex items-center space-x-2 mb-1 text-[10px] text-slate-400">
              <span className="font-semibold text-slate-300">Gemini Sales Partner</span>
              <span>•</span>
              <span>{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
            <div className="p-4 rounded-2xl max-w-[95%] text-xs leading-relaxed glass-panel border border-slate-800 text-slate-200 rounded-tl-none bg-slate-900/95 shadow-xl font-sans">
              <p className="text-xs text-slate-200 leading-relaxed">
                Hello Director! How can I assist you with your sales &amp; deals today?
              </p>
            </div>
          </div>
        )}

        {streamMessages.map((msg, idx) => (
          <div
            key={`${msg.role}-${idx}-${msg.timestamp}`}
            className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
          >
            <div className="flex items-center space-x-2 mb-1 text-[10px] text-slate-400">
              <span className="font-semibold text-slate-300">
                {msg.role === 'user' ? 'Director' : 'Gemini Sales Partner'}
              </span>
              <span>•</span>
              <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            </div>

            <div
              className={`p-4 rounded-2xl max-w-[95%] text-xs leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-tr-none shadow-md shadow-blue-600/20'
                  : 'glass-panel border border-slate-800 text-slate-200 rounded-tl-none bg-slate-900/95 shadow-xl font-sans'
              }`}
            >
              {/* Formatted Rich Markdown Renderer */}
              {msg.role === 'user' ? (
                <div className="whitespace-pre-wrap font-sans text-xs">{msg.content}</div>
              ) : (
                <FormattedMarkdownContent content={msg.content} />
              )}

              {/* Voice Read Controls on Assistant messages */}
              {msg.role === 'assistant' && msg.content && (
                <div className="mt-3 pt-2 border-t border-slate-800/60 flex items-center justify-between">
                  <button
                    onClick={() => speakText(msg.content)}
                    className="flex items-center space-x-1.5 px-2.5 py-1 rounded-md bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/20 text-[10px] font-bold transition-all active:scale-95"
                  >
                    <Volume2 className="w-3.5 h-3.5" />
                    <span>{isSpeaking ? 'Replay Voice' : '🔊 Speak Response'}</span>
                  </button>

                  {isSpeaking && (
                    <button
                      onClick={stopSpeech}
                      className="flex items-center space-x-1 px-2 py-0.5 rounded bg-rose-500/20 text-rose-400 border border-rose-500/30 text-[10px] font-bold"
                    >
                      <VolumeX className="w-3 h-3" />
                      <span>Stop Speech</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}

        {isStreaming && streamMessages.length > 0 && streamMessages[streamMessages.length - 1]?.content === '' && (
          <div className="flex items-center space-x-2 text-xs text-blue-400 bg-blue-500/10 border border-blue-500/20 rounded-xl p-3 animate-pulse">
            <Sparkles className="w-4 h-4 text-blue-400 animate-spin" />
            <span>Gemini AI analyzing deal quotes, comments, sales orders &amp; win probability...</span>
          </div>
        )}

        {errorState && (
          <div className="flex items-center justify-between gap-2 text-xs text-rose-300 bg-rose-500/15 border border-rose-500/30 rounded-xl p-3 shadow-lg my-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{errorState}</span>
            </div>
            <button
              onClick={retryLastMessage}
              className="px-3 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded-lg font-bold text-[11px] shrink-0 transition-all shadow-md active:scale-95 flex items-center gap-1"
            >
              <Zap className="w-3 h-3 text-amber-300" />
              <span>Try Again</span>
            </button>
          </div>
        )}

        <div ref={chatEndRef} />
      </div>



      {/* Input Bar with File Upload & Microphone */}
      <div className="p-4 border-t border-slate-800 bg-slate-900/95">

        {/* File Attachment Chip Badge (if file attached) */}
        {attachedFile && (
          <div className="mb-2.5 px-3 py-1.5 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-between text-xs text-blue-200">
            <div className="flex items-center space-x-2 truncate">
              <FileText className="w-4 h-4 text-blue-400 shrink-0" />
              <span className="font-semibold truncate">{attachedFile.name}</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 uppercase font-bold">
                {attachedFile.name.split('.').pop()}
              </span>
            </div>
            <button
              onClick={() => setAttachedFile(null)}
              className="p-1 rounded-md text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors ml-2"
              title="Remove Attachment"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Upload in progress */}
        {isUploading && (
          <div className="mb-2 px-3.5 py-1.5 rounded-xl bg-blue-500/20 border border-blue-500/40 text-xs text-blue-300 flex items-center space-x-2 animate-pulse">
            <Sparkles className="w-4 h-4 text-blue-400 animate-spin shrink-0" />
            <span className="font-semibold">Extracting text from file...</span>
          </div>
        )}

        {/* Live Mic Transcript Notification */}
        {isListening && (
          <div className="mb-2 px-3.5 py-1.5 rounded-xl bg-rose-500/20 border border-rose-500/40 text-xs text-rose-300 flex items-center space-x-2 animate-pulse shadow-md shadow-rose-500/20">
            <Radio className="w-4 h-4 text-rose-400 animate-spin shrink-0" />
            <span className="font-semibold">{speechTranscript || 'Listening... Speak your question now (auto-submits on pause)'}</span>
          </div>
        )}

        <div className="flex items-center space-x-2">
          {/* File Upload Button */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept=".pdf,.xlsx,.xls,.csv,.docx,.doc,.txt,.json"
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700/80 transition-all hover:scale-105 disabled:opacity-50"
            title="Upload Quote, PDF, Excel, or Word Document"
          >
            <Paperclip className="w-4 h-4 text-indigo-400" />
          </button>

          {/* Microphone Button */}
          <button
            type="button"
            onClick={handleSpeechInput}
            className={`p-2.5 rounded-xl border transition-all ${
              isListening
                ? 'bg-rose-500/30 text-rose-300 border-rose-500 animate-pulse shadow-lg shadow-rose-500/20 ring-2 ring-rose-500/50'
                : 'bg-slate-800 text-slate-300 border-slate-700/80 hover:bg-slate-700'
            }`}
            title="Hands-Free Voice Input (Speak and auto-submit)"
          >
            {isListening ? <MicOff className="w-4 h-4 text-rose-400" /> : <Mic className="w-4 h-4 text-cyan-400" />}
          </button>

          {/* Text Input */}
          <input
            type="text"
            value={inputQuery}
            onChange={(e) => setInputQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder={attachedFile ? "Ask a question about the attached quote/document..." : "Tap mic & speak, or type deal ID (e.g. 3742)..."}
            className="flex-1 px-3.5 py-2.5 rounded-xl bg-slate-950/90 border border-slate-700/80 text-slate-100 text-xs focus:outline-none focus:border-blue-500 transition-all placeholder:text-slate-500"
          />

          {/* Send Button */}
          <button
            type="button"
            onClick={() => handleSend()}
            disabled={(!inputQuery.trim() && !attachedFile) || isStreaming}
            className="p-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold transition-all shadow-lg shadow-blue-600/20 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
