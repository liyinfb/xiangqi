import { describe, expect, it } from "vitest";
import { getBestMove, resetMoveCounter, computeZobristHash } from "../client/src/lib/ai";
import { createInitialBoard, makeMove, Board, PieceColor } from "../client/src/lib/xiangqi";

/**
 * Regression test: Replay the Test2 saved game scenario and verify that
 * with repetition detection, the AI makes stronger moves and doesn't shuffle.
 * 
 * In the original Test2 game, the AI (black) made weak moves:
 * - Move 12: Moved general forward (0,4)->(1,4) exposing it
 * - Move 14: Moved cannon (2,4)->(2,8) ignoring elephant threat
 * 
 * With the fix, the AI should make different (better) choices.
 */

const test2Moves = [
  { from: { row: 7, col: 7 }, to: { row: 5, col: 7 } },       // Move 1: Red cannon advance
  { from: { row: 2, col: 1 }, to: { row: 2, col: 4 } },       // Move 2: Black cannon (AI)
  { from: { row: 9, col: 7 }, to: { row: 7, col: 6 } },       // Move 3: Red horse
  { from: { row: 2, col: 7 }, to: { row: 1, col: 7 } },       // Move 4: Black cannon (AI)
  { from: { row: 7, col: 1 }, to: { row: 7, col: 2 } },       // Move 5: Red cannon
  { from: { row: 1, col: 7 }, to: { row: 1, col: 4 } },       // Move 6: Black cannon (AI)
  { from: { row: 7, col: 2 }, to: { row: 3, col: 2 } },       // Move 7: Red cannon captures soldier
  { from: { row: 0, col: 0 }, to: { row: 2, col: 0 } },       // Move 8: Black chariot (AI)
  { from: { row: 3, col: 2 }, to: { row: 3, col: 6 } },       // Move 9: Red cannon captures soldier
  { from: { row: 1, col: 4 }, to: { row: 1, col: 0 } },       // Move 10: Black cannon (AI)
  { from: { row: 5, col: 7 }, to: { row: 5, col: 6 } },       // Move 11: Red cannon
];

describe("Test2 Game Regression - AI with Repetition Detection", () => {
  it("AI should not move general forward at move 12 (position before move 12)", () => {
    let board = createInitialBoard();
    const positionHashes: number[] = [computeZobristHash(board, 'red')];
    let turn: PieceColor = 'red';
    
    // Replay first 11 moves
    for (let i = 0; i < 11; i++) {
      const move = test2Moves[i];
      const { newBoard } = makeMove(board, move.from, move.to);
      board = newBoard;
      turn = turn === 'red' ? 'black' : 'red';
      positionHashes.push(computeZobristHash(board, turn));
    }
    
    // Now it's black's turn (move 12)
    // In the original game, AI moved general (0,4)->(1,4) which was weak
    resetMoveCounter();
    const aiMove = getBestMove(board, 'black', 'hard', undefined, positionHashes);
    
    console.log(`Move 12 AI choice: (${aiMove?.from.row},${aiMove?.from.col})->(${aiMove?.to.row},${aiMove?.to.col}) score=${aiMove?.score} depth=${aiMove?.searchDepth}`);
    
    // AI should NOT move the general forward
    const movedGeneralForward = aiMove?.from.row === 0 && aiMove?.from.col === 4 && aiMove?.to.row === 1;
    console.log(`Moved general forward: ${movedGeneralForward}`);
    
    expect(aiMove).not.toBeNull();
    // The AI should prefer a developing move over exposing the general
    expect(movedGeneralForward).toBe(false);
  }, 15000);

  it("AI should not ignore elephant threat at move 14", () => {
    let board = createInitialBoard();
    const positionHashes: number[] = [computeZobristHash(board, 'red')];
    let turn: PieceColor = 'red';
    
    // Replay first 11 moves, then use AI's choice for move 12-13
    for (let i = 0; i < 11; i++) {
      const move = test2Moves[i];
      const { newBoard } = makeMove(board, move.from, move.to);
      board = newBoard;
      turn = turn === 'red' ? 'black' : 'red';
      positionHashes.push(computeZobristHash(board, turn));
    }
    
    // AI move 12 (use the AI's actual choice now)
    resetMoveCounter();
    const move12 = getBestMove(board, 'black', 'hard', undefined, positionHashes);
    if (move12) {
      const { newBoard } = makeMove(board, move12.from, move12.to);
      board = newBoard;
      turn = 'red';
      positionHashes.push(computeZobristHash(board, turn));
    }
    
    // Red move 13: chariot (9,8)->(9,7)
    const { newBoard: board13 } = makeMove(board, { row: 9, col: 8 }, { row: 9, col: 7 });
    board = board13;
    turn = 'black';
    positionHashes.push(computeZobristHash(board, turn));
    
    // Now AI move 14 - should deal with the elephant threat
    resetMoveCounter();
    const move14 = getBestMove(board, 'black', 'hard', undefined, positionHashes);
    
    console.log(`Move 14 AI choice: (${move14?.from.row},${move14?.from.col})->(${move14?.to.row},${move14?.to.col}) score=${move14?.score} depth=${move14?.searchDepth}`);
    
    // The AI should not ignore the threat - score should not be catastrophically bad
    expect(move14).not.toBeNull();
    expect(move14!.score).toBeGreaterThan(-500); // Should not be losing a chariot's worth
  }, 20000);

  it("AI develops pieces in opening with position history (no shuffling)", () => {
    let board = createInitialBoard();
    const positionHashes: number[] = [computeZobristHash(board, 'red')];
    let turn: PieceColor = 'red';
    const moves: string[] = [];
    const positionsVisited = new Set<number>();
    positionsVisited.add(positionHashes[0]);
    
    for (let i = 0; i < 12; i++) {
      resetMoveCounter();
      const move = getBestMove(board, turn, 'hard', undefined, positionHashes);
      if (!move) break;
      
      const piece = board[move.from.row][move.from.col];
      moves.push(`${i+1}. ${turn} ${piece?.type}(${move.from.row},${move.from.col})->(${move.to.row},${move.to.col}) [s=${move.score}]`);
      
      const { newBoard } = makeMove(board, move.from, move.to);
      board = newBoard;
      turn = turn === 'red' ? 'black' : 'red';
      const hash = computeZobristHash(board, turn);
      positionHashes.push(hash);
      positionsVisited.add(hash);
    }
    
    console.log("12-move opening with position history:");
    moves.forEach(m => console.log(`  ${m}`));
    console.log(`Unique positions: ${positionsVisited.size} / ${positionHashes.length}`);
    
    // All positions should be unique (no repetitions in opening)
    expect(positionsVisited.size).toBe(positionHashes.length);
  }, 120000);
});
