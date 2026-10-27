import { BrandMark } from "@/components/shell/brand-mark";
import { ui } from "@/lib/labels";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center bg-paper px-4 py-10">
      <div className="w-full max-w-100 rounded-control border border-line bg-panel p-8">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <span className="flex items-center gap-2 text-brand">
            <BrandMark className="size-8" />
            <span className="font-serif text-lead font-semibold text-ink">{ui.shell.brand}</span>
          </span>
          <h1 className="font-serif text-title font-semibold text-ink">{ui.login.title}</h1>
          <p className="text-sm text-ink-muted">{ui.login.subtitle}</p>
        </div>
        <LoginForm />
      </div>
      <p className="mt-6 text-caption text-ink-muted">{ui.shell.footer}</p>
    </main>
  );
}
