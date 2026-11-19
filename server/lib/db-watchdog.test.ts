import { describe, expect, it, vi } from "vitest";
import { createDbWatchdog } from "./db-watchdog";

function setup(results: Array<"ok" | "fail" | "hang">) {
  const onExhausted = vi.fn();
  let call = 0;
  const tick = createDbWatchdog({
    probe: () => {
      const r = results[call++];
      if (r === "ok") return Promise.resolve();
      if (r === "hang") return new Promise(() => {});
      return Promise.reject(new Error("timeout exceeded when trying to connect"));
    },
    maxFailures: 3,
    probeTimeoutMs: 20,
    onExhausted,
    log: () => {},
  });
  return { tick, onExhausted };
}

describe("createDbWatchdog", () => {
  it("fires after maxFailures consecutive failures with the last error", async () => {
    const { tick, onExhausted } = setup(["fail", "fail", "fail"]);
    await tick();
    await tick();
    expect(onExhausted).not.toHaveBeenCalled();
    await tick();
    expect(onExhausted).toHaveBeenCalledWith("timeout exceeded when trying to connect");
  });

  it("does not fire when a success interrupts the failure streak", async () => {
    const { tick, onExhausted } = setup(["fail", "fail", "ok", "fail", "fail"]);
    for (let i = 0; i < 5; i++) await tick();
    expect(onExhausted).not.toHaveBeenCalled();
  });

  it("counts a hung probe as a failure", async () => {
    const { tick, onExhausted } = setup(["hang", "hang", "hang"]);
    for (let i = 0; i < 3; i++) await tick();
    expect(onExhausted).toHaveBeenCalledWith("probe timed out after 20ms");
  });
});
