import { ui } from "@/lib/labels";

export function Forbidden() {
  return (
    <section className="mx-auto max-w-md py-16 text-center">
      <p className="text-sm font-semibold text-red-600">403</p>
      <h1 className="mt-2 text-xl font-semibold">{ui.forbidden.title}</h1>
      <p className="mt-2 text-sm text-neutral-600">{ui.forbidden.body}</p>
    </section>
  );
}
