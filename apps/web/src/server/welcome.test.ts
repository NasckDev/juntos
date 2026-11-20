import { describe, expect, it } from "vitest";
import { needsWelcome } from "./welcome";

describe("needsWelcome", () => {
  it("só o convidado com o nome padrão vê as boas-vindas", () => {
    expect(needsWelcome({ isAnonymous: true, name: "Convidado" })).toBe(true);
    expect(needsWelcome({ isAnonymous: true, name: "Rafa" })).toBe(false);
    expect(needsWelcome({ isAnonymous: false, name: "Convidado" })).toBe(false);
    expect(needsWelcome({ isAnonymous: false, name: "Rafa Souza" })).toBe(false);
  });
});
