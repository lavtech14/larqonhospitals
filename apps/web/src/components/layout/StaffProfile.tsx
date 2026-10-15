"use client";

import { useStaffUser } from "@/components/auth/StaffSessionGate";

export default function StaffProfile() {
  const user = useStaffUser();

  const initials = user.fullName
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join("")
    .toUpperCase();

  return (
    <div className="profile">
      <span className="avatar" aria-hidden="true">
        {initials}
      </span>

      <div className="profile-details">
        <strong>{user.fullName}</strong>
        <small>{user.email}</small>
      </div>
    </div>
  );
}
