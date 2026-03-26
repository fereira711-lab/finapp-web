"use client";

import Sidebar from "./Sidebar";
import BottomNav from "./BottomNav";
import MobileHeader from "./MobileHeader";

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-dark-900">
      <Sidebar />
      <MobileHeader />
      <main className="md:ml-64 pt-14 md:pt-0 pb-20 md:pb-0 min-h-screen">
        <div className="max-w-5xl mx-auto px-4 py-4 md:py-6">{children}</div>
      </main>
      <BottomNav />
    </div>
  );
}
