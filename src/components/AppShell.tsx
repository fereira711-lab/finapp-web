"use client";

import Sidebar from "./Sidebar";
import BottomNav from "./BottomNav";
import MobileHeader from "./MobileHeader";

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <Sidebar />
      <MobileHeader />
      <main className="md:ml-64 pt-14 md:pt-0 pb-20 md:pb-0 min-h-screen px-4">
        <div className="glass mx-auto max-w-2xl mt-4 mb-4 p-4 md:p-6">
          {children}
        </div>
      </main>
      <BottomNav />
    </div>
  );
}
