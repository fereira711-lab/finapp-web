"use client";

import Sidebar from "./Sidebar";
import BottomNav from "./BottomNav";
import MobileHeader from "./MobileHeader";

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <Sidebar />
      <MobileHeader />
      <main className="md:ml-64 pt-16 pb-20 md:py-8 min-h-screen px-4 md:px-10 md:flex md:items-center md:justify-center">
        <div className="glass w-full max-w-3xl p-4 md:p-6 mx-auto">
          {children}
        </div>
      </main>
      <BottomNav />
    </div>
  );
}
