import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function createPublicContext(): TrpcContext {
  return {
    user: null,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as unknown as TrpcContext["res"],
  };
}

describe("game.explainMove", () => {
  it("returns a string explanation for a move context", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.game.explainMove({
      context: "The AI (playing black) moved its Chariot from position (row 0, col 0) to (row 5, col 0). Current material balance: AI has 200 points, opponent has 200 points.",
    });

    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  }, 30000);
});
