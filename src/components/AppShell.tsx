"use client";

import Sidebar from "./Sidebar";
import BottomNav from "./BottomNav";
import MobileHeader from "./MobileHeader";

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <Sidebar />
      <MobileHeader />
      <main className="md:ml-64 pt-14 md:pt-0 pb-20 md:pb-0 min-h-screen px-3 md:px-6 md:flex md:items-center md:justify-center">
        <div className="glass w-full max-w-4xl mt-2 md:mt-0 mb-4 md:mb-0 p-4 md:p-6 md:my-6 mx-auto">
          {children}
        </div>
      </main>
      <BottomNav />
    </div>
  );
}
