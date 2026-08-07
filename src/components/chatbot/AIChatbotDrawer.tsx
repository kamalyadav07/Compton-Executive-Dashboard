import React, { useState, useRef, useEffect } from 'react';
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
  Image as ImageIcon,
  TrendingUp,
  Target,
  FileSpreadsheet,
  Zap,
  Radio
} from 'lucide-react';
import * as XLSX from 'xlsx';
import type { DealRecord, KPIMetrics, ChatMessage } from '../../types/sales';
import { processGeminiRAGQuery, type FileAttachmentPayload } from '../../ai/geminiRAG';

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

    if (headers.length > 0) {
      elements.push(
        <div key={`table-${keyIndex}`} className="my-3 overflow-x-auto rounded-xl border border-slate-700/80 bg-slate-950/90 shadow-xl">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-800/90 text-blue-300 font-bold uppercase text-[10px] tracking-wider border-b border-slate-700">
              <tr>
                {headers.map((h, i) => (
                  <th key={i} className="p-2.5">{renderInlineMarkdown(h)}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {dataRows.map((r, rIdx) => {
                const cells = parseCells(r);
                return (
                  <tr key={rIdx} className="hover:bg-slate-900/60 transition-colors">
                    {cells.map((cell, cIdx) => (
                      <td key={cIdx} className="p-2.5 text-slate-200 font-medium">
                        {renderInlineMarkdown(cell)}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      );
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
  text = text.replace(/[\\/<>(){}[\]]/g, ' ');

  // 5. Clean whitespace & extract first ~3-4 key sentences for crisp human voice
  text = text.replace(/\s+/g, ' ').trim();
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
  return sentences.slice(0, 4).join(' ');
};

export const AIChatbotDrawer: React.FC<AIChatbotDrawerProps> = ({
  isOpen,
  onClose,
  records,
  kpis
}) => {
  const [inputQuery, setInputQuery] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [speechTranscript, setSpeechTranscript] = useState('');
  const [autoSpeak, setAutoSpeak] = useState(true); // Default ON for natural conversation!
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [attachedFile, setAttachedFile] = useState<FileAttachmentPayload | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const latestTranscriptRef = useRef<string>('');

  const getInitialMessage = (): ChatMessage => ({
    id: `init-${Date.now()}`,
    sender: 'assistant',
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    text: `Hello Director! How can I assist you with your sales & deals today?`
  });

  const [messages, setMessages] = useState<ChatMessage[]>([getInitialMessage()]);

  const handleClearChat = () => {
    if (isSpeaking) stopSpeech();
    setMessages([getInitialMessage()]);
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isProcessing]);

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

  const handleSend = async (queryText?: string) => {
    const textToSend = queryText || inputQuery;
    if ((!textToSend.trim() && !attachedFile) || isProcessing) return;

    const currentFile = attachedFile;
    const fileLabel = currentFile ? ` 📎 [Attached: ${currentFile.name}]` : '';
    const userMsgText = textToSend ? `${textToSend}${fileLabel}` : `Please analyze attached document: ${currentFile?.name}`;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      text: userMsgText
    };

    setMessages(prev => [...prev, userMsg]);
    setInputQuery('');
    setSpeechTranscript('');
    latestTranscriptRef.current = '';
    setAttachedFile(null); // Reset attachment after send
    setIsProcessing(true);

    try {
      const response = await processGeminiRAGQuery(
        textToSend || `Analyze attached file ${currentFile?.name}`,
        records,
        kpis,
        undefined,
        currentFile || undefined
      );

      setMessages(prev => [...prev, response]);

      // Auto-speak if enabled
      if (autoSpeak) {
        speakText(response.text);
      }
    } catch (err) {
      console.error("Chat error:", err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fileName = file.name;
    const lowerName = fileName.toLowerCase();

    // 1. Image Files (.png, .jpg, .jpeg, .webp)
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (evt) => {
        const base64 = evt.target?.result as string;
        setAttachedFile({
          name: fileName,
          type: 'image',
          content: base64,
          mimeType: file.type
        });
      };
      reader.readAsDataURL(file);
      return;
    }

    // 2. Excel & CSV (.xlsx, .xls, .csv)
    if (lowerName.endsWith('.xlsx') || lowerName.endsWith('.xls') || lowerName.endsWith('.csv')) {
      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const data = new Uint8Array(evt.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheet = workbook.SheetNames[0];
          const csvText = XLSX.utils.sheet_to_csv(workbook.Sheets[firstSheet]);
          setAttachedFile({
            name: fileName,
            type: 'excel',
            content: csvText
          });
        } catch (err) {
          console.error("Error parsing Excel file:", err);
          alert("Could not parse Excel spreadsheet. Please upload standard XLSX or CSV file.");
        }
      };
      reader.readAsArrayBuffer(file);
      return;
    }

    // 3. PDF Files (.pdf) - Read as Base64 DataURL for Gemini 2.5 Flash Native PDF multimodal analysis!
    if (lowerName.endsWith('.pdf') || file.type === 'application/pdf') {
      const reader = new FileReader();
      reader.onload = (evt) => {
        const base64 = evt.target?.result as string;
        setAttachedFile({
          name: fileName,
          type: 'pdf',
          content: base64,
          mimeType: 'application/pdf'
        });
      };
      reader.readAsDataURL(file);
      return;
    }

    // 4. Text, Word, JSON (.txt, .docx, .json, etc.)
    const reader = new FileReader();
    reader.onload = (evt) => {
      const textContent = evt.target?.result as string || '';
      setAttachedFile({
        name: fileName,
        type: lowerName.endsWith('.docx') || lowerName.endsWith('.doc') ? 'word' : 'text',
        content: textContent
      });
    };
    reader.readAsText(file);
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

  const quickQuestions = [
    "Deep-dive deal BITRIX-3742",
    "Win probability for Sudhir Kamate",
    "What are my closing chances for Panacea?",
    "How to increase win probability for RegisterKaro?",
    "Compare deal 3742 with deal 3408",
    "Highest revenue sales rep"
  ];

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
            <p className="text-[11px] text-slate-400">Speak naturally — auto-submits & responds out loud</p>
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
        {quickQuestions.map((q, idx) => (
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
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
          >
            <div className="flex items-center space-x-2 mb-1 text-[10px] text-slate-400">
              <span className="font-semibold text-slate-300">
                {msg.sender === 'user' ? 'Director' : 'Gemini Sales Partner'}
              </span>
              <span>•</span>
              <span>{msg.timestamp}</span>
            </div>

            <div
              className={`p-4 rounded-2xl max-w-[95%] text-xs leading-relaxed ${
                msg.sender === 'user'
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-tr-none shadow-md shadow-blue-600/20'
                  : 'glass-panel border border-slate-800 text-slate-200 rounded-tl-none bg-slate-900/95 shadow-xl font-sans'
              }`}
            >
              {/* Formatted Rich Markdown Renderer */}
              {msg.sender === 'user' ? (
                <div className="whitespace-pre-wrap font-sans text-xs">{msg.text}</div>
              ) : (
                <FormattedMarkdownContent content={msg.text} />
              )}

              {/* Voice Read Controls on Assistant messages */}
              {msg.sender === 'assistant' && (
                <div className="mt-3 pt-2 border-t border-slate-800/60 flex items-center justify-between">
                  <button
                    onClick={() => speakText(msg.text)}
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

        {isProcessing && (
          <div className="flex items-center space-x-2 text-xs text-blue-400 bg-blue-500/10 border border-blue-500/20 rounded-xl p-3 animate-pulse">
            <Sparkles className="w-4 h-4 text-blue-400 animate-spin" />
            <span>Gemini 2.5 Flash analyzing deal quotes, comments, sales orders & win probability...</span>
          </div>
        )}

        <div ref={chatEndRef} />
      </div>

      {/* Quick Action Suggestion Footer */}
      <div className="px-4 py-2 bg-slate-950/90 border-t border-slate-800/80 flex items-center space-x-2 overflow-x-auto scrollbar-none text-[11px]">
        <button
          onClick={() => handleSend("Tell me how to increase win probability for deal BITRIX-3742")}
          className="px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 whitespace-nowrap font-semibold flex items-center space-x-1"
        >
          <TrendingUp className="w-3 h-3 text-emerald-400" />
          <span>📈 Increase Win Chances</span>
        </button>
        <button
          onClick={() => handleSend("Compare deal BITRIX-3742 with deal BITRIX-3408 in detail")}
          className="px-2.5 py-1 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border border-purple-500/30 whitespace-nowrap font-semibold flex items-center space-x-1"
        >
          <Target className="w-3 h-3 text-purple-400" />
          <span>⚖ Compare Deals</span>
        </button>
      </div>

      {/* Input Bar with File Upload & Microphone */}
      <div className="p-4 border-t border-slate-800 bg-slate-900/95">

        {/* File Attachment Chip Badge (if file attached) */}
        {attachedFile && (
          <div className="mb-2.5 px-3 py-1.5 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-between text-xs text-blue-200">
            <div className="flex items-center space-x-2 truncate">
              {attachedFile.type === 'image' ? (
                <ImageIcon className="w-4 h-4 text-purple-400 shrink-0" />
              ) : attachedFile.type === 'excel' ? (
                <FileSpreadsheet className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <FileText className="w-4 h-4 text-blue-400 shrink-0" />
              )}
              <span className="font-semibold truncate">{attachedFile.name}</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 uppercase font-bold">
                {attachedFile.type}
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
            accept=".pdf,.xlsx,.xls,.csv,.docx,.doc,.txt,.json,image/*"
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700/80 transition-all hover:scale-105"
            title="Upload Quote, PDF, Excel, Word, or Screenshot Image"
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
            disabled={(!inputQuery.trim() && !attachedFile) || isProcessing}
            className="p-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold transition-all shadow-lg shadow-blue-600/20 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
