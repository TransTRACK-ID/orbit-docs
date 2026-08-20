import { describe, expect, it } from "vitest";
import {
  DOC_GENERATION_STATUS_LABEL,
  isPendingDocGenerationStatus,
} from "./doc-generation-status";

describe("doc-generation-status", () => {
  it("treats in-flight statuses as pending", () => {
    expect(isPendingDocGenerationStatus("generating_srs")).toBe(true);
    expect(isPendingDocGenerationStatus("cloning")).toBe(true);
  });

  it("treats terminal statuses as not pending", () => {
    expect(isPendingDocGenerationStatus("completed")).toBe(false);
    expect(isPendingDocGenerationStatus("failed")).toBe(false);
    expect(isPendingDocGenerationStatus("cancelled")).toBe(false);
  });

  it("exposes readable status labels", () => {
    expect(DOC_GENERATION_STATUS_LABEL.generating_srs).toBe("Generating SRS");
  });
});
