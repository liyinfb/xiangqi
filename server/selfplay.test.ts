import { describe, expect, it } from "vitest";
import { getBestMove, resetMoveCounter, ttClear, Difficulty } from "../client/src/lib/ai";
import { createInitialBoard, makeMove, isCheckmate, isInCheck, getAllValidMoves, Board, PieceColor } from "../client/src/lib/xiangqi";

interface MoveDetail {
  move: number;
  color: string;
  depth: number;
  time: number;
  score: number;
  nodes: number;
}

function playSelfGame(redDifficulty: Difficulty, blackDifficulty: Difficulty, maxMoves: number): MoveDetail[] {
  let board = createInitialBoard();
  let currentTurn: PieceColor = 'red';
  const details: MoveDetail[] = [];

  ttClear();
  resetMoveCounter();

  for (let moveNum = 1; moveNum <= maxMoves; moveNum++) {
    const difficulty = currentTurn === 'red' ? redDifficulty : blackDifficulty;

    const start = Date.now();
    const aiMove = getBestMove(board, currentTurn, difficulty);
    const elapsed = Date.now() - start;

    if (!aiMove) break;

    details.push({
      move: moveNum,
      color: currentTurn,
      depth: aiMove.searchDepth,
      time: elapsed,
      score: aiMove.score,
      nodes: aiMove.nodesSearched || 0,
    });

    const result = makeMove(board, aiMove.from, aiMove.to);
    board = result.newBoard;

    const nextTurn: PieceColor = currentTurn === 'red' ? 'black' : 'red';
    if (isCheckmate(board, nextTurn)) break;
    const nextMoves = getAllValidMoves(board, nextTurn);
    if (nextMoves.length === 0) break;

    currentTurn = nextTurn;
  }

  return details;
}

describe("Self-Play AI Testing", () => {
  it("hard vs hard: 20-move game with performance analysis", () => {
    const details = playSelfGame('hard', 'hard', 20);

    const redMoves = details.filter(d => d.color === 'red');
    const blackMoves = details.filter(d => d.color === 'black');

    const avgDepthRed = redMoves.reduce((s, d) => s + d.depth, 0) / redMoves.length;
    const avgDepthBlack = blackMoves.reduce((s, d) => s + d.depth, 0) / blackMoves.length;
    const avgTimeRed = redMoves.reduce((s, d) => s + d.time, 0) / redMoves.length;
    const avgTimeBlack = blackMoves.reduce((s, d) => s + d.time, 0) / blackMoves.length;
    const maxDepth = Math.max(...details.map(d => d.depth));

    console.log("\n=== Hard vs Hard (20 moves) ===");
    console.log(`Red - Avg depth: ${avgDepthRed.toFixed(1)}, Avg time: ${avgTimeRed.toFixed(0)}ms`);
    console.log(`Black - Avg depth: ${avgDepthBlack.toFixed(1)}, Avg time: ${avgTimeBlack.toFixed(0)}ms`);
    console.log(`Max depth reached: ${maxDepth}`);
    // Calculate NPS
    const totalNodes = details.reduce((s, d) => s + d.nodes, 0);
    const totalTime = details.reduce((s, d) => s + d.time, 0);
    const nps = totalTime > 0 ? Math.round(totalNodes / (totalTime / 1000)) : 0;
    console.log(`Total nodes: ${totalNodes}, NPS: ${nps.toLocaleString()} nodes/sec`);

    console.log("\nMove details:");
    for (const d of details) {
      const moveNps = d.time > 0 ? Math.round(d.nodes / (d.time / 1000)) : 0;
      console.log(`  #${d.move} ${d.color}: depth=${d.depth}, time=${d.time}ms, score=${d.score}, nodes=${d.nodes}, nps=${moveNps.toLocaleString()}`);
    }

    // Assertions
    expect(details.length).toBeGreaterThan(10);
    expect(avgDepthRed).toBeGreaterThanOrEqual(5);
    expect(avgDepthBlack).toBeGreaterThanOrEqual(5);
    // No move should exceed 9s (hard mode uses 8s time limit + overhead)
    for (const d of details) {
      expect(d.time).toBeLessThanOrEqual(9000);
    }
  }, 120000);

  it("endgame: should search much deeper with fewer pieces", () => {
    // Endgame with fewer pieces - should reach higher depth
    const board: Board = Array(10).fill(null).map(() => Array(9).fill(null));
    board[0][4] = { type: 'general', color: 'black' };
    board[0][3] = { type: 'advisor', color: 'black' };
    board[9][4] = { type: 'general', color: 'red' };
    board[5][0] = { type: 'chariot', color: 'red' };
    board[7][7] = { type: 'cannon', color: 'red' };

    const start = Date.now();
    const move = getBestMove(board, 'red', 'hard');
    const elapsed = Date.now() - start;

    console.log("\n=== Endgame Depth Test ===");
    console.log(`Depth: ${move?.searchDepth}, Time: ${elapsed}ms, Score: ${move?.score}`);

    expect(move).not.toBeNull();
    // With only 5 pieces, should search very deep
    expect(move!.searchDepth).toBeGreaterThanOrEqual(10);
  }, 10000);

  it("midgame: performance after exchanges", () => {
    // Midgame position with some pieces exchanged
    const board: Board = Array(10).fill(null).map(() => Array(9).fill(null));
    board[0][4] = { type: 'general', color: 'black' };
    board[0][3] = { type: 'advisor', color: 'black' };
    board[0][5] = { type: 'advisor', color: 'black' };
    board[2][0] = { type: 'chariot', color: 'black' };
    board[4][4] = { type: 'cannon', color: 'black' };
    board[3][2] = { type: 'soldier', color: 'black' };
    board[3][6] = { type: 'soldier', color: 'black' };
    board[9][4] = { type: 'general', color: 'red' };
    board[9][3] = { type: 'advisor', color: 'red' };
    board[9][5] = { type: 'advisor', color: 'red' };
    board[7][8] = { type: 'chariot', color: 'red' };
    board[5][4] = { type: 'cannon', color: 'red' };
    board[6][2] = { type: 'soldier', color: 'red' };
    board[6][6] = { type: 'soldier', color: 'red' };

    const start = Date.now();
    const move = getBestMove(board, 'red', 'hard');
    const elapsed = Date.now() - start;

    console.log("\n=== Midgame Depth Test (14 pieces) ===");
    console.log(`Depth: ${move?.searchDepth}, Time: ${elapsed}ms, Score: ${move?.score}`);

    expect(move).not.toBeNull();
    // Midgame with 14 pieces should still reach good depth
    expect(move!.searchDepth).toBeGreaterThanOrEqual(8);
  }, 10000);
});
