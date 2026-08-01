import { AnnouncementBar } from '@/components/layout/AnnouncementBar';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';

export default function StorefrontLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-shell min-h-screen flex flex-col">
      <AnnouncementBar />
      <Navbar />
      <main className="flex-1 relative z-10">{children}</main>
      <Footer />
    </div>
  );
}
