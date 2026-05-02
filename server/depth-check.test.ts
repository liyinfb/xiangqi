import { describe, it, expect } from "vitest";
import { createInitialBoard } from "../client/src/lib/xiangqi";
import { getBestMove } from "../client/src/lib/ai";

describe("AI Depth Check", () => {
  it("hard mode reaches depth 5+ from initial position within 5s", () => {
    const board = createInitialBoard();
    const start = Date.now();
    const move = getBestMove(board, 'black', 'hard');
    const elapsed = Date.now() - start;
    console.log(`Hard mode: depth ${move?.searchDepth}, time ${elapsed}ms`);
    expect(move).not.toBeNull();
    expect(move!.searchDepth).toBeGreaterThanOrEqual(5);
    expect(elapsed).toBeLessThan(6000); // Should finish within ~5s
  }, 10000);
});
