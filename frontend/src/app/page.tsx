import { redirect } from "next/navigation";
import { Suspense } from "react";
import { homePath } from "@/components/shell/nav-config";
import { getMe } from "@/lib/server-api";
import { hasPermission } from "@/lib/permissions";

// Halaman awal menurut izin (Design System §7): admin tidak punya dashboard.view, jadi ke status sistem.
async function Landing(): Promise<never> {
  const result = await getMe();
  if (result.status !== "ok") redirect("/login");

  redirect(homePath((permission) => hasPermission(result.me.permissions, permission)));
}

export default function Home() {
  return (
    <Suspense fallback={null}>
      <Landing />
    </Suspense>
  );
}
