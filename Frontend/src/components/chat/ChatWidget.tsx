'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { MoonStar, X, Send, Sparkles, Mic } from 'lucide-react';
import { useAcharyaChat } from '@/hooks/use-acharya-chat';
import { useVoiceInput } from '@/hooks/use-voice-input';

export function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [showPop, setShowPop] = useState(false);
  const [input, setInput] = useState('');
  const { messages, sendMessage, isSending } = useAcharyaChat();
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleVoiceResult = useCallback((transcript: string) => {
    setInput((prev) => (prev ? `${prev} ${transcript}` : transcript));
  }, []);
  const handleVoiceError = useCallback((error: string) => {
    console.error('[voice input] speech recognition error:', error);
  }, []);
  const voice = useVoiceInput({ lang: 'hi-IN', onResult: handleVoiceResult, onError: handleVoiceError });

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
    <>
      {/* Chat panel — full-screen takeover on mobile (its own page, not a corner widget),
          a generously sized panel on desktop with real presence, not a cramped support-bot box. */}
      {open && (
        <div className="fixed inset-0 z-50 sm:inset-auto sm:bottom-6 sm:right-6 sm:left-auto sm:top-auto w-full h-full sm:w-[420px] sm:h-[680px] sm:max-h-[85vh] bg-white sm:rounded-3xl shadow-2xl sm:border sm:border-[#2B1B0C]/15 flex flex-col overflow-hidden animate-fade-in-up">
          {/* Header */}
          <div className="flex items-center gap-3 px-4 sm:px-5 py-4 sm:py-5 bg-[#2B1B0C] flex-shrink-0">
            <div className="w-10 h-10 rounded-full border border-[#9C5A26]/50 bg-gradient-to-br from-[#C9863F] to-[#6B3D19] flex items-center justify-center flex-shrink-0">
              <MoonStar className="w-5 h-5 text-[#E6D3AE]" strokeWidth={1.5} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-heading font-bold text-sm text-[#E6D3AE] truncate">Acharya Madhav</p>
              <p className="font-body text-[11px] text-[#9C5A26]">Vedic Astrologer · Online</p>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="p-2 rounded-full hover:bg-white/10 transition-colors flex-shrink-0"
              aria-label="Close chat"
            >
              <X className="w-5 h-5 text-[#E6D3AE]" />
            </button>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 sm:px-5 py-5 flex flex-col gap-4">
            {messages.map((m, i) => (
              <div key={i} className={`flex flex-col gap-2 max-w-[88%] sm:max-w-[85%] ${m.role === 'user' ? 'self-end' : 'self-start'}`}>
                <div
                  className={`rounded-2xl px-4 py-3 font-body text-sm leading-relaxed whitespace-pre-line ${
                    m.role === 'user'
                      ? 'bg-[#9C5A26] text-white rounded-br-sm'
                      : 'bg-[#F6E4C2]/60 text-[#2B1B0C] rounded-bl-sm'
                  }`}
                >
                  {m.content}
                </div>
                {m.recommendedProducts && m.recommendedProducts.length > 0 && (
                  <div className="flex flex-col gap-1.5">
                    {m.recommendationReason && (
                      <p className="font-body text-xs italic text-[#8A7A63] px-1 leading-relaxed">
                        {m.recommendationReason}
                      </p>
                    )}
                    {m.recommendedProducts.map((p) => (
                      <Link
                        key={p.id}
                        href={`/products/${p.slug}`}
                        className="flex items-center gap-3 bg-white border border-[#2B1B0C]/10 rounded-xl px-3 py-2.5 hover:border-[#9C5A26] transition-colors"
                      >
                        <div className="relative w-10 h-10 rounded-lg bg-[#F6E4C2] flex-shrink-0 overflow-hidden flex items-center justify-center">
                          {p.thumb ? (
                            <Image src={p.thumb} alt={p.name} fill className="object-cover" sizes="40px" />
                          ) : (
                            <Sparkles className="w-4 h-4 text-[#9C5A26]" />
                          )}
                        </div>
                        <p className="flex-1 min-w-0 font-heading font-bold text-xs text-[#2B1B0C] truncate">{p.name}</p>
                        <span className="flex-shrink-0 font-body text-[11px] font-semibold text-[#9C5A26]">View →</span>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {isSending && (
              <div className="self-start bg-[#F6E4C2]/60 rounded-2xl rounded-bl-sm px-4 py-3 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#9C5A26]/50 animate-pulse" />
                <span className="w-1.5 h-1.5 rounded-full bg-[#9C5A26]/50 animate-pulse [animation-delay:150ms]" />
                <span className="w-1.5 h-1.5 rounded-full bg-[#9C5A26]/50 animate-pulse [animation-delay:300ms]" />
              </div>
            )}
          </div>

          {/* Input */}
          <form onSubmit={handleSubmit} className="flex items-center gap-2 p-3 sm:p-4 border-t border-[#2B1B0C]/10 flex-shrink-0">
            {voice.supported && (
              <button
                type="button"
                onClick={voice.listening ? voice.stop : voice.start}
                aria-label={voice.listening ? 'Stop recording' : 'Speak instead of typing'}
                className={`flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center transition-colors ${
                  voice.listening ? 'bg-red-500 animate-pulse' : 'bg-[#2B1B0C]/10 hover:bg-[#2B1B0C]/20'
                }`}
              >
                <Mic className={`w-4 h-4 ${voice.listening ? 'text-white' : 'text-[#2B1B0C]'}`} />
              </button>
            )}
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={voice.listening ? 'Listening...' : 'Ask about love, money, career...'}
              className="flex-1 bg-white border border-[#2B1B0C]/15 rounded-full px-4 py-2.5 text-sm focus:ring-2 focus:ring-[#9C5A26] focus:outline-none font-body placeholder:text-[#8A7A63]"
            />
            <button
              type="submit"
              disabled={isSending || !input.trim()}
              className="flex-shrink-0 w-9 h-9 rounded-full bg-[#9C5A26] flex items-center justify-center hover:bg-[#2B1B0C] transition-colors disabled:opacity-40"
              aria-label="Send"
            >
              <Send className="w-4 h-4 text-white" />
            </button>
          </form>
        </div>
      )}

      {/* Floating launcher — bubble + toggle button, hidden once the panel is open */}
      <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-40 flex flex-col items-end gap-3">
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
    </>
  );
}
