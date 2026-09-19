'use client';

import { useState } from 'react';
import { MapPin, MessageCircle, Phone, Calendar, Sparkles, ExternalLink, X } from 'lucide-react';
import { Topbar } from '@/components/layout/Topbar';
import { cn, formatDate } from '@/lib/utils';
import {
  useChatSessions,
  useChatSessionDetail,
  useChatVolume,
  useChatLeads,
  useUpdateChatLeadStatus,
} from '@/hooks/use-chat-sessions';
import { ChatVolumeChart } from '@/components/charts/ChatVolumeChart';
import type { ChatLeadStatus } from '@/types/api.types';

function locationLabel(city: string | null, country: string | null): string {
  if (!city && !country) return 'Unknown location';
  return [city, country].filter(Boolean).join(', ');
}

function TranscriptPanel({ sessionId, onClose }: { sessionId: string; onClose: () => void }) {
  const { data: session, isLoading } = useChatSessionDetail(sessionId);

  return (
    <div className="w-full lg:w-[420px] shrink-0 bg-white border border-slate-200 rounded-lg shadow-card flex flex-col h-[calc(100vh-140px)] lg:sticky lg:top-24">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-xs font-bold text-slate-900 truncate">{session?.name || sessionId}</p>
            {session?.phone && (
              <a
                href={`https://wa.me/${session.phone.replace(/\D/g, '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 hover:bg-emerald-100"
              >
                <Phone className="w-3 h-3" /> WhatsApp <ExternalLink className="w-2.5 h-2.5" />
              </a>
            )}
          </div>
          {session && (
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-slate-500">
              <span className="flex items-center gap-1">
                <MapPin className="w-3 h-3 text-slate-400" /> {locationLabel(session.city, session.country)}
              </span>
              {session.dob && (
                <span className="flex items-center gap-1 text-amber-700 font-medium">
                  <Calendar className="w-3 h-3" /> DOB: {session.dob}
                </span>
              )}
            </div>
          )}
        </div>
        <button onClick={onClose} className="p-1.5 rounded-full hover:bg-slate-100 shrink-0 ml-2" aria-label="Close">
          <X className="w-4 h-4 text-slate-500" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3">
        {isLoading && <p className="text-xs text-slate-400">Loading transcript...</p>}
        {session?.messages.map((m, i) => (
          <div
            key={i}
            className={cn(
              'max-w-[85%] rounded-xl px-3.5 py-2.5 text-xs leading-relaxed whitespace-pre-line shadow-sm',
              m.role === 'user'
                ? 'self-end bg-[#9C5A26] text-white rounded-br-none'
                : 'self-start bg-slate-100 text-slate-800 rounded-bl-none'
            )}
          >
            {m.content}
          </div>
        ))}
        {session && session.messages.length === 0 && <p className="text-xs text-slate-400">No messages recorded.</p>}
      </div>
    </div>
  );
}

export default function ChatSessionsPage() {
  const [activeTab, setActiveTab] = useState<'sessions' | 'leads'>('sessions');
  const { data, isLoading } = useChatSessions();
  const { data: volume } = useChatVolume(30);
  const { data: leadsData, isLoading: leadsLoading } = useChatLeads();
  const updateLeadMutation = useUpdateChatLeadStatus();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const sessions = data?.sessions ?? [];
  const leads = leadsData?.leads ?? [];
  const totalToday = volume?.trend[volume.trend.length - 1]?.count ?? 0;
  const total30d = volume?.trend.reduce((sum, p) => sum + p.count, 0) ?? 0;
  const totalLeadsCount = leadsData?.total ?? leads.length;

  return (
    <div>
      <Topbar title="Acharya Chat & Leads" />

      {/* KPI Cards */}
      <div className="px-6 pt-6 grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl">
        <div className="bg-white border border-slate-200 rounded-lg shadow-card p-4">
          <p className="text-[11px] uppercase tracking-wide text-slate-400 font-semibold">Messages today</p>
          <p className="text-2xl font-heading font-bold text-slate-900 mt-1">{totalToday}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg shadow-card p-4">
          <p className="text-[11px] uppercase tracking-wide text-slate-400 font-semibold">Last 30 days messages</p>
          <p className="text-2xl font-heading font-bold text-slate-900 mt-1">{total30d}</p>
        </div>
        <div className="bg-white border border-emerald-200 bg-emerald-50/40 rounded-lg shadow-card p-4">
          <p className="text-[11px] uppercase tracking-wide text-emerald-700 font-semibold">Captured Phone Leads</p>
          <p className="text-2xl font-heading font-bold text-emerald-800 mt-1">{totalLeadsCount}</p>
        </div>
      </div>

      {/* Volume Trend Chart */}
      <div className="px-6 pt-4">
        <div className="bg-white border border-slate-200 rounded-lg shadow-card p-4">
          <p className="text-xs font-semibold text-slate-500 mb-2">Chat volume — last 30 days</p>
          <ChatVolumeChart data={volume?.trend ?? []} />
        </div>
      </div>

      {/* Tabs */}
      <div className="px-6 pt-6">
        <div className="flex border-b border-slate-200 gap-6">
          <button
            onClick={() => setActiveTab('sessions')}
            className={cn(
              'pb-3 text-sm font-semibold border-b-2 -mb-px transition-colors flex items-center gap-2',
              activeTab === 'sessions'
                ? 'border-[#9C5A26] text-[#9C5A26]'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            )}
          >
            <MessageCircle className="w-4 h-4" /> Live Chat Sessions ({sessions.length})
          </button>
          <button
            onClick={() => setActiveTab('leads')}
            className={cn(
              'pb-3 text-sm font-semibold border-b-2 -mb-px transition-colors flex items-center gap-2',
              activeTab === 'leads'
                ? 'border-[#9C5A26] text-[#9C5A26]'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            )}
          >
            <Phone className="w-4 h-4 text-emerald-600" /> WhatsApp / Phone Leads ({totalLeadsCount})
          </button>
        </div>
      </div>

      {/* Tab 1: Sessions List */}
      {activeTab === 'sessions' && (
        <div className="p-6 flex flex-col lg:flex-row gap-4 items-start">
          <div className="flex-1 w-full min-w-0 bg-white border border-slate-200 rounded-lg shadow-card overflow-x-auto">
            <table className="w-full text-sm min-w-[700px]">
              <thead>
                <tr className="border-b border-slate-200 text-left text-[11px] uppercase tracking-wide text-slate-400">
                  <th className="px-4 py-3 font-semibold">User & Location</th>
                  <th className="px-4 py-3 font-semibold">Phone / WhatsApp</th>
                  <th className="px-4 py-3 font-semibold">DOB / Problem</th>
                  <th className="px-4 py-3 font-semibold">Last message</th>
                  <th className="px-4 py-3 font-semibold">Messages</th>
                  <th className="px-4 py-3 font-semibold">Last active</th>
                </tr>
              </thead>
              <tbody>
                {isLoading && (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">Loading sessions...</td></tr>
                )}
                {!isLoading && sessions.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">No chat sessions recorded yet.</td></tr>
                )}
                {sessions.map((s) => (
                  <tr
                    key={s.sessionId}
                    onClick={() => setSelectedId(s.sessionId)}
                    className={cn(
                      'border-b border-slate-100 last:border-0 cursor-pointer hover:bg-slate-50 transition-colors',
                      selectedId === s.sessionId && 'bg-[#9C5A26]/5'
                    )}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 font-medium text-slate-900">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        {locationLabel(s.city, s.country)}
                      </div>
                      <p className="text-[11px] text-slate-400 font-mono">{s.ip}</p>
                    </td>
                    <td className="px-4 py-3">
                      {s.phone ? (
                        <a
                          href={`https://wa.me/${s.phone.replace(/\D/g, '')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200 hover:bg-emerald-100"
                        >
                          <Phone className="w-3 h-3" /> {s.phone}
                        </a>
                      ) : (
                        <span className="text-xs text-slate-400 italic">Not captured</span>
                      )}
                    </td>
                    <td className="px-4 py-3 max-w-[200px]">
                      {s.dob && (
                        <p className="text-xs font-medium text-amber-800 flex items-center gap-1">
                          <Calendar className="w-3 h-3" /> {s.dob}
                        </p>
                      )}
                      {s.problem && (
                        <p className="text-[11px] text-slate-600 truncate">{s.problem}</p>
                      )}
                      {!s.dob && !s.problem && <span className="text-xs text-slate-400">—</span>}
                    </td>
                    <td className="px-4 py-3 max-w-xs">
                      <p className="text-slate-600 truncate">{s.lastMessagePreview || '—'}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      <span className="inline-flex items-center gap-1 font-medium">
                        <MessageCircle className="w-3.5 h-3.5 text-slate-400" /> {s.messageCount}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500 whitespace-nowrap text-xs">{formatDate(s.lastMessageAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {selectedId && <TranscriptPanel sessionId={selectedId} onClose={() => setSelectedId(null)} />}
        </div>
      )}

      {/* Tab 2: Captured Leads */}
      {activeTab === 'leads' && (
        <div className="p-6">
          <div className="bg-white border border-slate-200 rounded-lg shadow-card overflow-x-auto">
            <table className="w-full text-sm min-w-[800px]">
              <thead>
                <tr className="border-b border-slate-200 text-left text-[11px] uppercase tracking-wide text-slate-400">
                  <th className="px-4 py-3 font-semibold">Phone / WhatsApp</th>
                  <th className="px-4 py-3 font-semibold">Name & DOB</th>
                  <th className="px-4 py-3 font-semibold">Problem / Purpose</th>
                  <th className="px-4 py-3 font-semibold">Location</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Date Captured</th>
                  <th className="px-4 py-3 font-semibold">Action</th>
                </tr>
              </thead>
              <tbody>
                {leadsLoading && (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">Loading leads...</td></tr>
                )}
                {!leadsLoading && leads.length === 0 && (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">No phone leads captured yet. Leads will appear here automatically when users share their number in chat.</td></tr>
                )}
                {leads.map((lead) => (
                  <tr key={lead.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-900">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-semibold">{lead.phone}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-xs font-semibold text-slate-800">{lead.name || 'Anonymous'}</p>
                      {lead.dob ? (
                        <p className="text-[11px] text-amber-700 flex items-center gap-1 mt-0.5">
                          <Calendar className="w-3 h-3" /> {lead.dob}
                        </p>
                      ) : (
                        <p className="text-[11px] text-slate-400">DOB not shared</p>
                      )}
                    </td>
                    <td className="px-4 py-3 max-w-xs">
                      {lead.purpose && (
                        <span className="inline-block px-2 py-0.5 bg-[#9C5A26]/10 text-[#9C5A26] rounded text-[10px] font-bold uppercase mb-1">
                          {lead.purpose}
                        </span>
                      )}
                      <p className="text-xs text-slate-700 line-clamp-2">{lead.problem || 'General astrology guidance'}</p>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {locationLabel(lead.city, lead.country)}
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={lead.status}
                        onChange={(e) =>
                          updateLeadMutation.mutate({
                            id: lead.id,
                            status: e.target.value as ChatLeadStatus,
                          })
                        }
                        className={cn(
                          'text-xs font-semibold px-2 py-1 rounded border',
                          lead.status === 'NEW' && 'bg-blue-50 text-blue-700 border-blue-200',
                          lead.status === 'CONTACTED' && 'bg-amber-50 text-amber-700 border-amber-200',
                          lead.status === 'CONVERTED' && 'bg-emerald-50 text-emerald-700 border-emerald-200',
                          lead.status === 'CLOSED' && 'bg-slate-50 text-slate-600 border-slate-200'
                        )}
                      >
                        <option value="NEW">NEW</option>
                        <option value="CONTACTED">CONTACTED</option>
                        <option value="CONVERTED">CONVERTED</option>
                        <option value="CLOSED">CLOSED</option>
                      </select>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">
                      {formatDate(lead.createdAt)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <a
                        href={`https://wa.me/${lead.phone.replace(/\D/g, '')}?text=${encodeURIComponent(
                          `Pranam ${lead.name || ''}, Doshhmukti se Acharya Madhav team. Aapne chat me margdarshan manga tha, hum aapki poori report share kar rahe hain.`
                        )}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 text-white font-medium text-xs hover:bg-emerald-700 transition-colors shadow-sm"
                      >
                        <Phone className="w-3.5 h-3.5" /> Chat on WhatsApp
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
