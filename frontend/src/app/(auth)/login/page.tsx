import { ui } from "@/lib/labels";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <main className="flex flex-1 items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <h1 className="mb-6 text-center text-xl font-semibold">{ui.login.title}</h1>
        <LoginForm />
      </div>
    </main>
  );
}
