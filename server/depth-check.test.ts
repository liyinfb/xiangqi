import { describe, it, expect, beforeEach } from "vitest";
import { createInitialBoard } from "../client/src/lib/xiangqi";
import { getBestMove, resetMoveCounter, ttClear } from "../client/src/lib/ai";

describe("AI Depth Check", () => {
  beforeEach(() => {
    resetMoveCounter();
    ttClear();
  });

  it("hard mode reaches depth 8+ from initial position within 9s", () => {
    const board = createInitialBoard();
    const start = Date.now();
    const move = getBestMove(board, 'black', 'hard');
    const elapsed = Date.now() - start;
    console.log(`Hard mode: depth ${move?.searchDepth}, time ${elapsed}ms, nodes ${move?.nodesSearched}`);
    expect(move).not.toBeNull();
    expect(move!.searchDepth).toBeGreaterThanOrEqual(8);
    expect(elapsed).toBeLessThan(9000); // Hard mode uses 8s time limit
  }, 15000);
});
