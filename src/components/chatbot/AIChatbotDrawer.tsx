import React, { useState, useRef, useEffect } from 'react';
import { 
  Bot, 
  Send, 
  X, 
  Sparkles, 
  Mic, 
  MicOff, 
  Volume2
} from 'lucide-react';
import type { DealRecord, KPIMetrics, ChatMessage } from '../../types/sales';
import { processGeminiRAGQuery } from '../../ai/geminiRAG';

interface AIChatbotDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  records: DealRecord[];
  kpis: KPIMetrics;
}

export const AIChatbotDrawer: React.FC<AIChatbotDrawerProps> = ({
  isOpen,
  onClose,
  records,
  kpis
}) => {
  const [inputQuery, setInputQuery] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isListening, setIsListening] = useState(false);

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'init-1',
      sender: 'assistant',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      text: `Hello Director! I am your **Senior AI Sales Analyst** powered by Google Gemini RAG.
      
I answer **strictly using your uploaded Excel deal files**. Ask me anything about revenue, lost deals, top sales reps, conversion rates, or future forecasts!`
    }
  ]);

  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (queryText?: string) => {
    const textToSend = queryText || inputQuery;
    if (!textToSend.trim() || isProcessing) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      text: textToSend
    };

    setMessages(prev => [...prev, userMsg]);
    setInputQuery('');
    setIsProcessing(true);

    try {
      const response = await processGeminiRAGQuery(textToSend, records, kpis);
      setMessages(prev => [...prev, response]);
    } catch (err) {
      console.error("Chat error:", err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSpeechInput = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      alert("Speech recognition is not supported in this browser.");
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = false;

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setInputQuery(transcript);
      handleSend(transcript);
    };

    recognition.start();
  };

  const handleTextToSpeech = (text: string) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text.replace(/[*#]/g, ''));
      utterance.rate = 1.0;
      window.speechSynthesis.speak(utterance);
    }
  };

  const quickQuestions = [
    "Which sales executive generated highest revenue?",
    "Who lost the biggest deal?",
    "What is our overall win rate?",
    "Why are deals getting lost?",
    "Which lead source generated maximum revenue?",
    "Generate board meeting summary"
  ];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full max-w-lg glass-panel border-l border-slate-700/80 shadow-2xl flex flex-col justify-between">
      <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/80">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center shadow-md shadow-blue-500/20">
            <Bot className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="text-sm font-bold text-slate-100">AI Sales Analyst</h3>
              <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                Excel Data Connected
              </span>
            </div>
            <p className="text-[11px] text-slate-400">Answers questions directly from your sales files</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="p-3 bg-slate-950/40 border-b border-slate-800/60 overflow-x-auto flex space-x-2 scrollbar-none">
        {quickQuestions.map((q, idx) => (
          <button
            key={idx}
            onClick={() => handleSend(q)}
            className="px-3 py-1 rounded-full bg-slate-800/80 hover:bg-slate-700 text-slate-300 text-[11px] font-medium whitespace-nowrap border border-slate-700/60 transition-all active:scale-95 shrink-0"
          >
            {q}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map(msg => (
          <div
            key={msg.id}
            className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
          >
            <div className="flex items-center space-x-2 mb-1 text-[10px] text-slate-400">
              <span>{msg.sender === 'user' ? 'Director' : 'Gemini AI Analyst'}</span>
              <span>•</span>
              <span>{msg.timestamp}</span>
            </div>

            <div
              className={`p-3.5 rounded-2xl max-w-[90%] text-xs leading-relaxed ${
                msg.sender === 'user'
                  ? 'bg-blue-600 text-white rounded-tr-none shadow-md shadow-blue-600/20'
                  : 'glass-panel border border-slate-800 text-slate-200 rounded-tl-none bg-slate-900/90'
              }`}
            >
              <div className="whitespace-pre-wrap font-sans">{msg.text}</div>

              {msg.tableData && (
                <div className="mt-3 overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/80 p-2">
                  <table className="w-full text-left text-[11px]">
                    <thead className="bg-slate-900 text-slate-400 uppercase text-[9px] font-bold">
                      <tr>
                        {msg.tableData.headers.map((h, i) => (
                          <th key={i} className="p-2">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {msg.tableData.rows.map((row, rIdx) => (
                        <tr key={rIdx} className="hover:bg-slate-900/50">
                          {row.map((cell, cIdx) => (
                            <td key={cIdx} className="p-2 text-slate-200">{cell}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {msg.sender === 'assistant' && (
                <button
                  onClick={() => handleTextToSpeech(msg.text)}
                  className="mt-2.5 flex items-center space-x-1 text-[10px] text-indigo-400 hover:text-indigo-300 font-semibold"
                >
                  <Volume2 className="w-3 h-3" />
                  <span>Listen Audio</span>
                </button>
              )}
            </div>
          </div>
        ))}
        {isProcessing && (
          <div className="flex items-center space-x-2 text-xs text-slate-400 italic p-2">
            <Sparkles className="w-4 h-4 text-blue-400 animate-spin" />
            <span>Gemini searching RAG deal embeddings...</span>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* 7-Layer Intelligence Quick Suggestions */}
      <div className="px-4 py-2 bg-slate-950/80 border-t border-slate-800/80 flex items-center space-x-1.5 overflow-x-auto scrollbar-none text-[11px]">
        <button
          onClick={() => handleSend("Analyze deal win probability for RegisterKaro using 7-layer model")}
          className="px-2.5 py-1 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-300 border border-blue-500/30 whitespace-nowrap font-medium"
        >
          🎯 7-Layer Deal Analysis
        </button>
        <button
          onClick={() => handleSend("Check company buying habits & missing AMC items")}
          className="px-2.5 py-1 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border border-purple-500/30 whitespace-nowrap font-medium"
        >
          ⚠ Check Habit & Missing Items
        </button>
        <button
          onClick={() => handleSend("Run scenario decision-support analysis for my top deal")}
          className="px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 whitespace-nowrap font-medium"
        >
          🚀 Scenario Analysis
        </button>
      </div>

      <div className="p-4 border-t border-slate-800 bg-slate-900/90">
        <div className="flex items-center space-x-2">
          <button
            onClick={handleSpeechInput}
            className={`p-2.5 rounded-xl border transition-all ${
              isListening
                ? 'bg-rose-500/20 text-rose-400 border-rose-500 animate-pulse'
                : 'bg-slate-800 text-slate-300 border-slate-700/80 hover:bg-slate-700'
            }`}
            title="Voice Assistant Query"
          >
            {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>

          <input
            type="text"
            value={inputQuery}
            onChange={(e) => setInputQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Ask AI analyst about deals, reps, or lost reasons..."
            className="flex-1 px-3.5 py-2.5 rounded-xl bg-slate-950/80 border border-slate-700/80 text-slate-100 text-xs focus:outline-none focus:border-blue-500"
          />

          <button
            onClick={() => handleSend()}
            disabled={!inputQuery.trim() || isProcessing}
            className="p-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold transition-all shadow-md shadow-blue-600/20 disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
