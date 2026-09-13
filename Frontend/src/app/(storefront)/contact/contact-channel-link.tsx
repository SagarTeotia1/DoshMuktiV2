'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { trackContact } from '@/lib/analytics';

// Meta's Contact standard event ("someone got in contact with your business via
// telephone, SMS, email, chat, etc") — fires when a visitor actually clicks through to
// WhatsApp/email/etc, not just for viewing this page. Split out from page.tsx (a Server
// Component, for its metadata export) since onClick needs a Client Component.
//
// `icon` is a pre-rendered ReactNode (page.tsx renders <Icon .../> itself), not the
// LucideIcon component reference — a Server Component can't pass a bare function/
// component reference across to a Client Component (Next.js can't serialize it, and
// fails the whole build with "Functions cannot be passed directly to Client
// Components"), but an already-rendered element is a normal serializable RSC payload.
export function ContactChannelLink({
  href,
  icon,
  label,
  detail,
  cta,
}: {
  href: string;
  icon: ReactNode;
  label: string;
  detail: string;
  cta: string;
}) {
  return (
    <Link
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => trackContact()}
      className="group flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 rounded-xl border border-[#2B1B0C]/12 bg-white p-5 sm:p-6 hover:border-[#9C5A26] hover:shadow-neo-md transition-all duration-300"
    >
      <div className="flex items-center gap-4 min-w-0">
        <span className="flex-shrink-0 w-12 h-12 rounded-full bg-[#F6E4C2] flex items-center justify-center group-hover:bg-[#9C5A26]/15 transition-colors duration-300">
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="font-heading font-bold text-sm text-[#2B1B0C]">{label}</h3>
          <p className="font-body text-xs text-[#8A7A63] truncate">{detail}</p>
        </div>
      </div>
      <span className="flex-shrink-0 font-body text-xs font-bold uppercase tracking-widest text-[#9C5A26] group-hover:text-[#2B1B0C] transition-colors duration-300">
        {cta} →
      </span>
    </Link>
  );
}
