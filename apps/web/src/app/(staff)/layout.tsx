import type { ReactNode } from "react";
import StaffSessionGate from "@/components/auth/StaffSessionGate";
import Header from "@/components/layout/Header";
import Sidebar from "@/components/layout/Sidebar";

export default function StaffLayout({ children }: { children: ReactNode }) {
  return (
    <StaffSessionGate>
      <div className="hospital-shell">
        <Sidebar />

        <div className="workspace">
          <Header />
          <main className="main-content">{children}</main>
        </div>
      </div>
    </StaffSessionGate>
  );
}
