'use client';

import { useState } from 'react';
import { MapPin, MessageCircle, X } from 'lucide-react';
import { Topbar } from '@/components/layout/Topbar';
import { cn, formatDate } from '@/lib/utils';
import { useChatSessions, useChatSessionDetail, useChatVolume } from '@/hooks/use-chat-sessions';
import { ChatVolumeChart } from '@/components/charts/ChatVolumeChart';

function locationLabel(city: string | null, country: string | null): string {
  if (!city && !country) return 'Unknown location';
  return [city, country].filter(Boolean).join(', ');
}

function TranscriptPanel({ sessionId, onClose }: { sessionId: string; onClose: () => void }) {
  const { data: session, isLoading } = useChatSessionDetail(sessionId);

  return (
    <div className="w-[380px] shrink-0 bg-white border border-slate-200 rounded-lg shadow-card flex flex-col h-[calc(100vh-140px)] sticky top-24">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
        <div className="min-w-0">
          <p className="text-xs font-bold text-slate-900 truncate">{sessionId}</p>
          {session && (
            <p className="text-[11px] text-slate-400 flex items-center gap-1">
              <MapPin className="w-3 h-3" /> {locationLabel(session.city, session.country)} · {session.ip}
            </p>
          )}
        </div>
        <button onClick={onClose} className="p-1.5 rounded-full hover:bg-slate-100 shrink-0" aria-label="Close">
          <X className="w-4 h-4 text-slate-500" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3">
        {isLoading && <p className="text-xs text-slate-400">Loading transcript...</p>}
        {session?.messages.map((m, i) => (
          <div key={i} className={cn('max-w-[85%] rounded-xl px-3 py-2 text-xs leading-relaxed whitespace-pre-line', m.role === 'user' ? 'self-end bg-[#9C5A26] text-white' : 'self-start bg-slate-100 text-slate-800')}>
            {m.content}
          </div>
        ))}
        {session && session.messages.length === 0 && <p className="text-xs text-slate-400">No messages recorded.</p>}
      </div>
    </div>
  );
}

export default function ChatSessionsPage() {
  const { data, isLoading } = useChatSessions();
  const { data: volume } = useChatVolume(30);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const sessions = data?.sessions ?? [];
  const totalToday = volume?.trend[volume.trend.length - 1]?.count ?? 0;
  const total30d = volume?.trend.reduce((sum, p) => sum + p.count, 0) ?? 0;

  return (
    <div>
      <Topbar title="Chat Sessions" />

      <div className="px-6 pt-6 grid grid-cols-2 gap-4 max-w-md">
        <div className="bg-white border border-slate-200 rounded-lg shadow-card p-4">
          <p className="text-[11px] uppercase tracking-wide text-slate-400 font-semibold">Messages today</p>
          <p className="text-2xl font-heading font-bold text-slate-900 mt-1">{totalToday}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg shadow-card p-4">
          <p className="text-[11px] uppercase tracking-wide text-slate-400 font-semibold">Last 30 days</p>
          <p className="text-2xl font-heading font-bold text-slate-900 mt-1">{total30d}</p>
        </div>
      </div>

      <div className="px-6 pt-4">
        <div className="bg-white border border-slate-200 rounded-lg shadow-card p-4">
          <p className="text-xs font-semibold text-slate-500 mb-2">Chat volume — last 30 days</p>
          <ChatVolumeChart data={volume?.trend ?? []} />
        </div>
      </div>

      <div className="p-6 flex gap-4 items-start">
        <div className="flex-1 bg-white border border-slate-200 rounded-lg shadow-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-[11px] uppercase tracking-wide text-slate-400">
                <th className="px-4 py-3 font-semibold">Location</th>
                <th className="px-4 py-3 font-semibold">Last message</th>
                <th className="px-4 py-3 font-semibold">Messages</th>
                <th className="px-4 py-3 font-semibold">Last active</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-400">Loading...</td></tr>
              )}
              {!isLoading && sessions.length === 0 && (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-400">No chat sessions recorded yet.</td></tr>
              )}
              {sessions.map((s) => (
                <tr
                  key={s.sessionId}
                  onClick={() => setSelectedId(s.sessionId)}
                  className={cn('border-b border-slate-100 last:border-0 cursor-pointer hover:bg-slate-50', selectedId === s.sessionId && 'bg-[#9C5A26]/5')}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5 font-medium text-slate-900">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      {locationLabel(s.city, s.country)}
                    </div>
                    <p className="text-[11px] text-slate-400">{s.ip}</p>
                  </td>
                  <td className="px-4 py-3 max-w-xs">
                    <p className="text-slate-600 truncate">{s.lastMessagePreview || '—'}</p>
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    <span className="inline-flex items-center gap-1"><MessageCircle className="w-3.5 h-3.5" /> {s.messageCount}</span>
                  </td>
                  <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{formatDate(s.lastMessageAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {selectedId && <TranscriptPanel sessionId={selectedId} onClose={() => setSelectedId(null)} />}
      </div>
    </div>
  );
}
