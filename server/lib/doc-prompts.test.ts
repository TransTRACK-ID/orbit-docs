import { describe, expect, it } from "vitest";
import { prependAdrConstraints } from "./doc-prompts";

describe("prependAdrConstraints", () => {
  it("returns prompt unchanged when no constraints", () => {
    expect(prependAdrConstraints("base prompt", "")).toBe("base prompt");
  });

  it("prepends binding block before prompt", () => {
    const result = prependAdrConstraints("Write SRS", "BINDING ADRs:\n- ADR-001: Use JWT");
    expect(result).toContain("BINDING ARCHITECTURAL DECISIONS");
    expect(result).toContain("Write SRS");
    expect(result.indexOf("BINDING ARCHITECTURAL DECISIONS")).toBeLessThan(
      result.indexOf("Write SRS")
    );
  });

  it("adds update alignment note for update prompts", () => {
    const result = prependAdrConstraints("Update FSD", "BINDING ADRs:\n- ADR-001", {
      isUpdate: true,
    });
    expect(result).toContain("Deviations");
  });
});
