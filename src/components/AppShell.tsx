"use client";

import BottomNav from "./BottomNav";
import MobileHeader from "./MobileHeader";

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <MobileHeader />
      <main className="pt-14 pb-20 min-h-screen px-4">
        <div className="glass mx-auto max-w-2xl mt-4 mb-4 p-4 md:p-6">
          {children}
        </div>
      </main>
      <BottomNav />
    </div>
  );
}
