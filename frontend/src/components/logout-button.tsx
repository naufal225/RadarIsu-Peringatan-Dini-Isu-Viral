"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/radar/button";
import { ui } from "@/lib/labels";

export function LogoutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function logout() {
    setPending(true);
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => null);
    router.replace("/login");
    router.refresh();
  }

  return (
    <Button onClick={logout} pending={pending}>
      <LogOut aria-hidden="true" className="size-4" />
      {ui.logout}
    </Button>
  );
}
