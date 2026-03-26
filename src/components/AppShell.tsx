"use client";

import BottomNav from "./BottomNav";
import MobileHeader from "./MobileHeader";

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <MobileHeader />
      <main className="pt-14 md:pt-4 pb-20 md:pb-4 min-h-screen px-3 md:px-6">
        <div className="glass mx-auto max-w-4xl mt-2 md:mt-4 mb-4 p-4 md:p-6">
          {children}
        </div>
      </main>
      <BottomNav />
    </div>
  );
}
