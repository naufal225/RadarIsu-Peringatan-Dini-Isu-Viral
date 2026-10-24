import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }) }));

import { LoginForm } from "./login-form";

// Regression: with a stale build the login chunks returned 500, the page never hydrated, and the
// browser submitted the form itself as a GET, putting the email and password in the URL.
// The HTML the server sends is all a non-hydrated browser ever has, so that is what is checked.
describe("LoginForm before hydration", () => {
  const html = renderToString(<LoginForm />);

  it("would submit with POST, never GET, so credentials cannot end up in the URL", () => {
    expect(html).toMatch(/<form[^>]*\smethod="post"/);
    expect(html).not.toMatch(/method="get"/i);
  });

  it("disables every field and the button until React has taken over", () => {
    expect(html).toMatch(/<fieldset[^>]*\sdisabled/);
    expect(html.indexOf("<fieldset")).toBeLessThan(html.indexOf('name="email"'));
    expect(html.indexOf("</fieldset>")).toBeGreaterThan(html.indexOf("<button"));
  });

  it("does not put the password field outside the fieldset", () => {
    const outside = html.replace(/<fieldset[\s\S]*<\/fieldset>/, "");
    expect(outside).not.toContain("<input");
    expect(outside).not.toContain("<button");
  });
});
