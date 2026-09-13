'use client';

import dynamic from 'next/dynamic';

// ChatWidget pulls in useAcharyaChat + useVoiceInput and renders unconditionally on every
// page it's mounted on, even though its panel starts closed — that executes real JS
// (component logic, hook setup, the whole widget tree) on first load whether or not the
// visitor ever opens chat, which shows up as main-thread work Lighthouse attributes to
// the initial page. `ssr: false` moves ChatWidget's chunk out of the initial bundle and
// off the server render entirely, so it loads after the page is already interactive.
//
// `ssr: false` is not allowed on `next/dynamic` inside a Server Component (Next throws a
// build error) — this file exists purely so page.tsx / layout.tsx (both Server
// Components) can render a Client Component wrapper instead of calling `dynamic()`
// themselves. See the ChatWidget.tsx listener effect for the `open-acharya-chat` race
// this lazy mount introduces.
const ChatWidget = dynamic(() => import('./ChatWidget').then((mod) => mod.ChatWidget), { ssr: false });

export function ChatWidgetLoader() {
  return <ChatWidget />;
}
