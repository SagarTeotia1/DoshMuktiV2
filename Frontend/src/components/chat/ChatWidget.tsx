'use client';

import { useState, useEffect, useRef } from 'react';
import { MoonStar, X, Send } from 'lucide-react';
import { useAcharyaChat } from '@/hooks/use-acharya-chat';

export function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [showPop, setShowPop] = useState(false);
  const [input, setInput] = useState('');
  const { messages, sendMessage, isSending } = useAcharyaChat();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setShowPop(true), 2500);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, isSending]);

  function handleOpen() {
    setOpen(true);
    setShowPop(false);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isSending) return;
    setInput('');
    void sendMessage(trimmed);
  }

  return (
    <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50 flex flex-col items-end gap-3">
      {/* Chat panel */}
      {open && (
        <div className="w-[calc(100vw-2rem)] max-w-[360px] h-[500px] max-h-[70vh] bg-[#FBF1DF] rounded-2xl shadow-2xl border border-[#2B1B0C]/10 flex flex-col overflow-hidden animate-fade-in-up">
          {/* Header */}
          <div className="flex items-center gap-2.5 px-4 py-3.5 bg-[#2B1B0C] flex-shrink-0">
            <div className="w-8 h-8 rounded-full border border-[#9C5A26]/50 bg-gradient-to-br from-[#C9863F] to-[#6B3D19] flex items-center justify-center flex-shrink-0">
              <MoonStar className="w-4 h-4 text-[#FBF1DF]" strokeWidth={1.5} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-heading font-bold text-xs text-[#FBF1DF] truncate">Acharya Madhav</p>
              <p className="font-body text-[10px] text-[#9C5A26]">Vedic Astrologer · Online</p>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="p-1.5 rounded-full hover:bg-white/10 transition-colors flex-shrink-0"
              aria-label="Close chat"
            >
              <X className="w-4 h-4 text-[#FBF1DF]" />
            </button>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-3.5 py-4 flex flex-col gap-3">
            {messages.map((m, i) => (
              <div
                key={i}
                className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 font-body text-xs leading-relaxed ${
                  m.role === 'user'
                    ? 'self-end bg-[#9C5A26] text-white rounded-br-sm'
                    : 'self-start bg-white text-[#2B1B0C] rounded-bl-sm'
                }`}
              >
                {m.content}
              </div>
            ))}
            {isSending && (
              <div className="self-start bg-white rounded-2xl rounded-bl-sm px-3.5 py-2.5 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#9C5A26]/50 animate-pulse" />
                <span className="w-1.5 h-1.5 rounded-full bg-[#9C5A26]/50 animate-pulse [animation-delay:150ms]" />
                <span className="w-1.5 h-1.5 rounded-full bg-[#9C5A26]/50 animate-pulse [animation-delay:300ms]" />
              </div>
            )}
          </div>

          {/* Input */}
          <form onSubmit={handleSubmit} className="flex items-center gap-2 p-3 border-t border-[#2B1B0C]/10 flex-shrink-0">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about love, money, career..."
              className="flex-1 bg-white border border-[#2B1B0C]/15 rounded-full px-3.5 py-2 text-xs focus:ring-2 focus:ring-[#9C5A26] focus:outline-none font-body placeholder:text-[#8A7A63]"
            />
            <button
              type="submit"
              disabled={isSending || !input.trim()}
              className="flex-shrink-0 w-8 h-8 rounded-full bg-[#9C5A26] flex items-center justify-center hover:bg-[#2B1B0C] transition-colors disabled:opacity-40"
              aria-label="Send"
            >
              <Send className="w-3.5 h-3.5 text-white" />
            </button>
          </form>
        </div>
      )}

      {/* Pop bubble */}
      {showPop && !open && (
        <div className="relative animate-fade-in-up">
          <button
            onClick={() => setShowPop(false)}
            className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-[#2B1B0C] flex items-center justify-center z-10"
            aria-label="Dismiss"
          >
            <X className="w-2.5 h-2.5 text-white" />
          </button>
          <button
            onClick={handleOpen}
            className="bg-white border border-[#2B1B0C]/10 shadow-xl rounded-2xl rounded-br-sm px-4 py-3 font-body text-xs font-semibold text-[#2B1B0C] max-w-[200px] text-left hover:-translate-y-0.5 transition-transform duration-200"
          >
            Chat With Acharya <span className="text-[#9C5A26]">For Free</span> ✨
          </button>
        </div>
      )}

      {/* Toggle button */}
      {!open && (
        <button
          onClick={handleOpen}
          aria-label="Chat with Acharya Madhav"
          className="relative w-14 h-14 rounded-full bg-[#9C5A26] shadow-neo-lg flex items-center justify-center hover:bg-[#2B1B0C] transition-colors duration-300 animate-pulse-glow"
        >
          <MoonStar className="w-6 h-6 text-white" strokeWidth={1.5} />
        </button>
      )}
    </div>
  );
}
