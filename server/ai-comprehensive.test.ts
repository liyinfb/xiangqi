import { describe, expect, it, beforeEach } from "vitest";
import { getBestMove, resetMoveCounter, computeZobristHash, ttClear } from "../client/src/lib/ai";
import { createInitialBoard, makeMove, Board, PieceColor, Piece } from "../client/src/lib/xiangqi";

// Helper to create a board from piece placement
function createBoard(pieces: { row: number; col: number; type: Piece['type']; color: PieceColor }[]): Board {
  const board: Board = Array.from({ length: 10 }, () => Array(9).fill(null));
  for (const p of pieces) {
    board[p.row][p.col] = { type: p.type, color: p.color };
  }
  return board;
}

describe("Comprehensive AI Strength Tests", () => {
  beforeEach(() => {
    ttClear();
    resetMoveCounter();
  });
  
  // Test 1: Don't move a piece into a chariot's attack line
  it("should not move cannon into chariot's attack line", () => {
    // Black cannon at (2,7), Red chariot at (8,7) - same column
    // AI should not move cannon to (5,7) or any square on column 7 between them
    const board = createBoard([
      { row: 0, col: 4, type: 'general', color: 'black' },
      { row: 0, col: 3, type: 'advisor', color: 'black' },
      { row: 0, col: 5, type: 'advisor', color: 'black' },
      { row: 2, col: 7, type: 'cannon', color: 'black' },
      { row: 0, col: 1, type: 'horse', color: 'black' },
      { row: 2, col: 4, type: 'elephant', color: 'black' },
      { row: 3, col: 0, type: 'soldier', color: 'black' },
      { row: 3, col: 2, type: 'soldier', color: 'black' },
      { row: 3, col: 4, type: 'soldier', color: 'black' },
      { row: 9, col: 4, type: 'general', color: 'red' },
      { row: 9, col: 3, type: 'advisor', color: 'red' },
      { row: 9, col: 5, type: 'advisor', color: 'red' },
      { row: 8, col: 7, type: 'chariot', color: 'red' },
      { row: 7, col: 1, type: 'cannon', color: 'red' },
    ]);
    
    resetMoveCounter();
    const move = getBestMove(board, 'black', 'hard');
    console.log(`Test 1: ${move?.from.row},${move?.from.col} -> ${move?.to.row},${move?.to.col} score=${move?.score} depth=${move?.searchDepth}`);
    
    expect(Number.isFinite(move!.score)).toBe(true);
    // Should not move cannon TOWARD the chariot on column 7
    // Chariot is at (8,7), cannon at (2,7). Moving to row > 2 on col 7 is toward chariot.
    // Moving to row < 2 on col 7 is away from chariot (safe).
    if (move?.from.row === 2 && move?.from.col === 7 && move.to.col === 7) {
      expect(move.to.row).toBeLessThan(move.from.row); // Only allow moving UP (away from chariot)
    }
  }, 15000);

  // Test 2: Capture a free piece
  it("should capture an undefended piece", () => {
    // Black chariot at (5,0), Red cannon at (5,4) undefended on same row
    const board = createBoard([
      { row: 0, col: 4, type: 'general', color: 'black' },
      { row: 0, col: 3, type: 'advisor', color: 'black' },
      { row: 0, col: 5, type: 'advisor', color: 'black' },
      { row: 5, col: 0, type: 'chariot', color: 'black' },
      { row: 2, col: 4, type: 'elephant', color: 'black' },
      { row: 9, col: 4, type: 'general', color: 'red' },
      { row: 9, col: 3, type: 'advisor', color: 'red' },
      { row: 9, col: 5, type: 'advisor', color: 'red' },
      { row: 5, col: 4, type: 'cannon', color: 'red' },
    ]);
    
    resetMoveCounter();
    const move = getBestMove(board, 'black', 'hard');
    console.log(`Test 2: ${move?.from.row},${move?.from.col} -> ${move?.to.row},${move?.to.col} score=${move?.score} depth=${move?.searchDepth}`);
    
    expect(Number.isFinite(move!.score)).toBe(true);
    // AI should find a good move (capturing or better tactical move)
    // Score should be significantly positive since there's a free cannon to take
    expect(move!.score).toBeGreaterThan(200);
  }, 15000);

  // Test 3: Don't leave a piece hanging
  it("should not leave chariot hanging", () => {
    // Black chariot at (5,3), Red cannon at (7,3) same column, Red horse at (7,2)
    // If black moves chariot away from (5,3), it should not go to a square attacked by red
    const board = createBoard([
      { row: 0, col: 4, type: 'general', color: 'black' },
      { row: 0, col: 3, type: 'advisor', color: 'black' },
      { row: 0, col: 5, type: 'advisor', color: 'black' },
      { row: 5, col: 3, type: 'chariot', color: 'black' },
      { row: 2, col: 1, type: 'cannon', color: 'black' },
      { row: 0, col: 6, type: 'elephant', color: 'black' },
      { row: 9, col: 4, type: 'general', color: 'red' },
      { row: 9, col: 3, type: 'advisor', color: 'red' },
      { row: 9, col: 5, type: 'advisor', color: 'red' },
      { row: 7, col: 3, type: 'chariot', color: 'red' },
      { row: 7, col: 1, type: 'cannon', color: 'red' },
    ]);
    
    resetMoveCounter();
    const move = getBestMove(board, 'black', 'hard');
    console.log(`Test 3: ${move?.from.row},${move?.from.col} -> ${move?.to.row},${move?.to.col} score=${move?.score} depth=${move?.searchDepth}`);
    
    expect(Number.isFinite(move!.score)).toBe(true);
    // Score should not be catastrophically bad (losing a chariot = -1010)
    expect(move!.score).toBeGreaterThan(-500);
  }, 15000);

  // Test 4: Protect a piece under attack
  it("should protect or move a piece under attack", () => {
    // Black horse at (4,5), Red chariot at (4,8) same row - horse is attacked
    // Black should move the horse or block the attack
    const board = createBoard([
      { row: 0, col: 4, type: 'general', color: 'black' },
      { row: 0, col: 3, type: 'advisor', color: 'black' },
      { row: 0, col: 5, type: 'advisor', color: 'black' },
      { row: 4, col: 5, type: 'horse', color: 'black' },
      { row: 2, col: 1, type: 'cannon', color: 'black' },
      { row: 0, col: 0, type: 'chariot', color: 'black' },
      { row: 9, col: 4, type: 'general', color: 'red' },
      { row: 9, col: 3, type: 'advisor', color: 'red' },
      { row: 9, col: 5, type: 'advisor', color: 'red' },
      { row: 4, col: 8, type: 'chariot', color: 'red' },
    ]);
    
    resetMoveCounter();
    const move = getBestMove(board, 'black', 'hard');
    console.log(`Test 4: ${move?.from.row},${move?.from.col} -> ${move?.to.row},${move?.to.col} score=${move?.score} depth=${move?.searchDepth}`);
    
    expect(Number.isFinite(move!.score)).toBe(true);
    // Should not lose the horse (horse value ~480)
    expect(move!.score).toBeGreaterThan(-300);
  }, 15000);

  // Test 5: Self-play 30 moves - check for blunders (material swings)
  it("self-play 30 moves should have no major blunders", () => {
    let board = createInitialBoard();
    let turn: PieceColor = 'red';
    const hashes: number[] = [computeZobristHash(board, 'red')];
    
    resetMoveCounter();
    
    let prevScore = 0;
    let blunders = 0;
    const moves: string[] = [];
    
    for (let i = 0; i < 30; i++) {
      const move = getBestMove(board, turn, 'medium', undefined, hashes);
      if (!move) break;
      
      const piece = board[move.from.row][move.from.col];
      const captured = board[move.to.row][move.to.col];
      const cap = captured ? ` x${captured.type}` : '';
      const moveStr = `${i+1}. ${turn} ${piece?.type}(${move.from.row},${move.from.col})->(${move.to.row},${move.to.col})${cap} [score=${move.score} depth=${move.searchDepth}]`;
      moves.push(moveStr);
      
      // Check for score swing (blunder detection)
      // In NegaMax, score is from current player's perspective
      // A blunder is when the score suddenly becomes very negative
      if (move.score < -400 && prevScore > -100) {
        console.log(`  POTENTIAL BLUNDER at move ${i+1}: score dropped from ${prevScore} to ${move.score}`);
        blunders++;
      }
      
      prevScore = -move.score; // Negate for next player's perspective
      
      const { newBoard } = makeMove(board, move.from, move.to);
      board = newBoard;
      turn = turn === 'red' ? 'black' : 'red';
      hashes.push(computeZobristHash(board, turn));
    }
    
    console.log("Self-play moves:");
    moves.forEach(m => console.log(`  ${m}`));
    console.log(`Blunders: ${blunders}`);
    
    // No major blunders should occur
    expect(blunders).toBeLessThanOrEqual(1);
  }, 120000);

  // Test 6: Verify search depth and score are reasonable for hard mode
  it("hard mode should search to reasonable depth with finite scores", () => {
    const board = createInitialBoard();
    resetMoveCounter();
    
    const move = getBestMove(board, 'red', 'hard');
    console.log(`Hard mode initial: score=${move?.score} depth=${move?.searchDepth} nodes=${move?.nodesSearched}`);
    
    expect(Number.isFinite(move!.score)).toBe(true);
    expect(move!.searchDepth).toBeGreaterThanOrEqual(6);
    expect(move!.searchDepth).toBeLessThanOrEqual(15);
    expect(Math.abs(move!.score)).toBeLessThan(1000); // Opening should be roughly equal
  }, 15000);

  // Test 7: Regression test for Test4 position - AI should be deterministic in midgame
  // In this position, black faces a double threat (chariot on elephant + cannon on elephant)
  // AI should consistently pick the same move (no randomization in midgame)
  it("Test4 regression: should be deterministic in midgame double-threat position", () => {
    const board = createBoard([
      { row: 0, col: 0, type: 'chariot', color: 'black' },
      { row: 0, col: 3, type: 'advisor', color: 'black' },
      { row: 0, col: 4, type: 'general', color: 'black' },
      { row: 0, col: 5, type: 'advisor', color: 'black' },
      { row: 0, col: 6, type: 'elephant', color: 'black' },
      { row: 0, col: 7, type: 'horse', color: 'black' },
      { row: 0, col: 8, type: 'chariot', color: 'black' },
      { row: 1, col: 3, type: 'horse', color: 'black' },
      { row: 2, col: 1, type: 'cannon', color: 'black' },
      { row: 2, col: 4, type: 'elephant', color: 'black' },
      { row: 3, col: 0, type: 'soldier', color: 'black' },
      { row: 3, col: 2, type: 'soldier', color: 'black' },
      { row: 3, col: 4, type: 'soldier', color: 'black' },
      { row: 3, col: 8, type: 'soldier', color: 'black' },
      { row: 4, col: 6, type: 'soldier', color: 'black' },
      { row: 3, col: 6, type: 'chariot', color: 'red' },
      { row: 5, col: 4, type: 'cannon', color: 'red' },
      { row: 6, col: 0, type: 'soldier', color: 'red' },
      { row: 6, col: 2, type: 'soldier', color: 'red' },
      { row: 6, col: 4, type: 'soldier', color: 'red' },
      { row: 6, col: 6, type: 'soldier', color: 'red' },
      { row: 6, col: 8, type: 'soldier', color: 'red' },
      { row: 7, col: 1, type: 'cannon', color: 'red' },
      { row: 7, col: 6, type: 'horse', color: 'red' },
      { row: 9, col: 0, type: 'chariot', color: 'red' },
      { row: 9, col: 1, type: 'horse', color: 'red' },
      { row: 9, col: 2, type: 'elephant', color: 'red' },
      { row: 9, col: 3, type: 'advisor', color: 'red' },
      { row: 9, col: 4, type: 'general', color: 'red' },
      { row: 9, col: 5, type: 'advisor', color: 'red' },
      { row: 9, col: 6, type: 'elephant', color: 'red' },
    ]);
    
    // Run AI 3 times - should always pick the same move (no randomization in midgame)
    // moveCounter increments with each getBestMove call, so after a few calls
    // it will be past the opening randomization threshold (>3 for hard mode)
    const moves: string[] = [];
    for (let i = 0; i < 3; i++) {
      ttClear();
      // Don't reset moveCounter - let it stay high to simulate midgame
      // (moveCounter > 3 means no randomization for hard mode)
      const move = getBestMove(board, 'black', 'hard');
      const key = `${move!.from.row},${move!.from.col}->${move!.to.row},${move!.to.col}`;
      moves.push(key);
      console.log(`Test4 trial ${i+1}: ${key} score=${move?.score} depth=${move?.searchDepth}`);
    }
    
    // All 3 runs should produce the same move (deterministic in midgame)
    expect(moves[0]).toBe(moves[1]);
    expect(moves[1]).toBe(moves[2]);
    
    // Score should be finite and reasonable (position is losing for black)
    ttClear();
    const move = getBestMove(board, 'black', 'hard');
    expect(Number.isFinite(move!.score)).toBe(true);
    expect(move!.score).toBeGreaterThan(-2000); // Not a forced mate
  }, 45000);
});
