import { Suspense } from 'react';
import { AnnouncementBar } from '@/components/layout/AnnouncementBar';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { ChatWidgetLoader } from '@/components/chat/ChatWidgetLoader';

export default function StorefrontLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-shell min-h-screen flex flex-col">
      <AnnouncementBar />
      <Suspense>
        <Navbar />
      </Suspense>
      <main className="flex-1 relative z-10">{children}</main>
      <Footer />
      <ChatWidgetLoader />
    </div>
  );
}
