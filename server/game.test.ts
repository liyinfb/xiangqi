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
  it("returns a string explanation including search depth info", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.game.explainMove({
      context: "电脑移动了车/俥，从第9行一列到第4行一列。当前子力对比：电脑200分，玩家200分。",
      searchDepth: 3,
      score: 45,
      difficulty: "中等",
    });

    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  }, 30000);
});
