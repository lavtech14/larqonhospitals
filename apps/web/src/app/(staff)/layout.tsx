import type { ReactNode } from "react";
import Header from "@/components/layout/Header";
import Sidebar from "@/components/layout/Sidebar";

export default function StaffLayout({ children }: { children: ReactNode }) {
  return (
    <div className="hospital-shell">
      <Sidebar />

      <div className="workspace">
        <Header />
        <main className="main-content">{children}</main>
      </div>
    </div>
  );
}
