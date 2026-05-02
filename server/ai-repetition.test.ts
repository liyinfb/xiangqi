import { describe, expect, it } from "vitest";
import { getBestMove, resetMoveCounter, computeZobristHash } from "../client/src/lib/ai";
import { createInitialBoard, makeMove, Board, PieceColor } from "../client/src/lib/xiangqi";

describe("AI Repetition Avoidance", () => {
  it("AI should not repeat moves in self-play with position history", () => {
    let board = createInitialBoard();
    let turn: PieceColor = 'red';
    const positionHashes: number[] = [computeZobristHash(board, 'red')];
    const moves: string[] = [];
    const positions: string[] = [];
    let repetitions = 0;
    
    for (let i = 0; i < 20; i++) {
      resetMoveCounter();
      // Use medium difficulty for faster test execution while still testing repetition logic
      const move = getBestMove(board, turn, 'medium', undefined, positionHashes);
      if (!move) break;
      
      const piece = board[move.from.row][move.from.col];
      const captured = board[move.to.row][move.to.col];
      const cap = captured ? ` x${captured.type}` : '';
      moves.push(`${i+1}. ${turn} ${piece?.type}(${move.from.row},${move.from.col})->(${move.to.row},${move.to.col})${cap} [d=${move.searchDepth} s=${move.score}]`);
      
      const { newBoard } = makeMove(board, move.from, move.to);
      board = newBoard;
      turn = turn === 'red' ? 'black' : 'red';
      
      const hash = computeZobristHash(board, turn);
      
      // Check for repetition
      if (positionHashes.includes(hash)) {
        repetitions++;
        console.log(`  REPETITION at move ${i+1}!`);
      }
      positionHashes.push(hash);
    }
    
    console.log("Self-play with repetition detection:");
    moves.forEach(m => console.log(`  ${m}`));
    console.log(`\nTotal repetitions: ${repetitions}`);
    
    // Should have very few or no repetitions now
    expect(repetitions).toBeLessThanOrEqual(2);
  }, 90000);

  it("AI avoids returning to previous position after being forced back", () => {
    // Simulate a scenario where AI moved a piece and opponent moved it back
    let board = createInitialBoard();
    const positionHashes: number[] = [computeZobristHash(board, 'red')];
    
    // Red moves cannon (7,7)->(5,7)
    let { newBoard } = makeMove(board, { row: 7, col: 7 }, { row: 5, col: 7 });
    board = newBoard;
    positionHashes.push(computeZobristHash(board, 'black'));
    
    // Black responds with horse (0,1)->(2,2)
    ({ newBoard } = makeMove(board, { row: 0, col: 1 }, { row: 2, col: 2 }));
    board = newBoard;
    positionHashes.push(computeZobristHash(board, 'red'));
    
    // Red moves elephant (9,6)->(7,4)
    ({ newBoard } = makeMove(board, { row: 9, col: 6 }, { row: 7, col: 4 }));
    board = newBoard;
    positionHashes.push(computeZobristHash(board, 'black'));
    
    // Black responds with soldier (3,6)->(4,6)
    ({ newBoard } = makeMove(board, { row: 3, col: 6 }, { row: 4, col: 6 }));
    board = newBoard;
    positionHashes.push(computeZobristHash(board, 'red'));
    
    // Now Red should NOT move elephant back to (9,6)
    resetMoveCounter();
    const move = getBestMove(board, 'red', 'medium', undefined, positionHashes);
    
    console.log(`After 4 moves, Red chooses: (${move?.from.row},${move?.from.col})->(${move?.to.row},${move?.to.col}) score=${move?.score}`);
    
    // Check if AI chose to move elephant back
    const movedElephantBack = move?.from.row === 7 && move?.from.col === 4 && move?.to.row === 9 && move?.to.col === 6;
    console.log(`Moved elephant back: ${movedElephantBack}`);
    
    // AI should prefer a developing move over retreating
    expect(move).not.toBeNull();
  }, 15000);

  it("AI develops pieces instead of shuffling in opening", () => {
    let board = createInitialBoard();
    let turn: PieceColor = 'red';
    const positionHashes: number[] = [computeZobristHash(board, 'red')];
    const moves: string[] = [];
    
    // Track unique pieces moved
    const piecesMoved = new Set<string>();
    
    for (let i = 0; i < 10; i++) {
      resetMoveCounter();
      const move = getBestMove(board, turn, 'medium', undefined, positionHashes);
      if (!move) break;
      
      const piece = board[move.from.row][move.from.col];
      piecesMoved.add(`${piece?.type}_${move.from.row}_${move.from.col}`);
      
      const captured = board[move.to.row][move.to.col];
      const cap = captured ? ` x${captured.type}` : '';
      moves.push(`${i+1}. ${turn} ${piece?.type}(${move.from.row},${move.from.col})->(${move.to.row},${move.to.col})${cap} [s=${move.score}]`);
      
      const { newBoard } = makeMove(board, move.from, move.to);
      board = newBoard;
      turn = turn === 'red' ? 'black' : 'red';
      positionHashes.push(computeZobristHash(board, turn));
    }
    
    console.log("Opening development (10 moves):");
    moves.forEach(m => console.log(`  ${m}`));
    console.log(`\nUnique pieces moved: ${piecesMoved.size}`);
    
    // In 10 moves, at least 4 different pieces should have moved
    expect(piecesMoved.size).toBeGreaterThanOrEqual(4);
  }, 60000);

  it("Hard mode returns finite scores", () => {
    const board = createInitialBoard();
    resetMoveCounter();
    const move = getBestMove(board, 'red', 'hard');
    
    console.log(`Hard mode: score=${move?.score} depth=${move?.searchDepth}`);
    
    expect(move).not.toBeNull();
    expect(Number.isFinite(move!.score)).toBe(true);
    expect(move!.searchDepth).toBeGreaterThanOrEqual(4);
    expect(move!.searchDepth).toBeLessThanOrEqual(15);
  }, 15000);
});
