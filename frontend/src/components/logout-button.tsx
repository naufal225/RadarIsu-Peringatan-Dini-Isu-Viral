"use client";

import { LogOut } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/radar/button";
import { ui } from "@/lib/labels";

/**
 * Keluar: revoke token di BFF, lalu navigasi penuh ke /login. Navigasi penuh membuang seluruh
 * state klien (data pengguna, cache halaman), jadi tidak ada spinner yang tertinggal.
 */
export function LogoutButton() {
  const [pending, setPending] = useState(false);

  async function logout() {
    setPending(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // Cookie dihapus di server saat request berhasil; jika gagal, tetap keluar ke halaman login.
    }
    // Sengaja navigasi penuh: router.push mempertahankan state klien dan cache RSC pengguna lama.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign("/login");
  }

  return (
    <Button onClick={logout} pending={pending}>
      <LogOut aria-hidden="true" className="size-4" />
      {ui.logout}
    </Button>
  );
}
