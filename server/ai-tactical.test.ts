import { describe, expect, it } from "vitest";
import { getBestMove, resetMoveCounter } from "../client/src/lib/ai";
import { Board, PieceColor, getAllValidMoves, isInCheck } from "../client/src/lib/xiangqi";

/**
 * Deterministic tactical regression tests for AI.
 * Each test presents a specific position where the AI must NOT blunder.
 * These positions simulate common midgame scenarios where a weak engine
 * might move a piece into free capture.
 */

function checkNoBlunder(board: Board, color: PieceColor, description: string): void {
  resetMoveCounter();
  const move = getBestMove(board, color, 'hard');
  expect(move).not.toBeNull();
  
  const piece = board[move!.from.row][move!.from.col];
  const captured = board[move!.to.row][move!.to.col];
  
  // After making the move, check if the moved piece can be immediately captured
  const newBoard = board.map(r => [...r]) as Board;
  newBoard[move!.to.row][move!.to.col] = piece;
  newBoard[move!.from.row][move!.from.col] = null;
  
  const opponentColor = color === 'red' ? 'black' : 'red';
  const opponentMoves = getAllValidMoves(newBoard, opponentColor);
  const canBeCaptured = opponentMoves.some(m => m.to.row === move!.to.row && m.to.col === move!.to.col);
  
  const PIECE_VAL: Record<string, number> = {
    general: 100000, advisor: 200, elephant: 200, horse: 480, chariot: 1000, cannon: 510, soldier: 100,
  };
  
  if (canBeCaptured && piece) {
    const movedValue = PIECE_VAL[piece.type];
    const capturedValue = captured ? PIECE_VAL[captured.type] : 0;
    const netLoss = movedValue - capturedValue;
    
    // Allow if: gives check, or net loss is small, or AI score indicates tactical sacrifice
    const givesCheck = isInCheck(newBoard, opponentColor);
    const wasAttacked = getAllValidMoves(board, opponentColor).some(
      m => m.to.row === move!.from.row && m.to.col === move!.from.col
    );
    
    if (!givesCheck && !wasAttacked && netLoss > 200 && move!.score < 100) {
      throw new Error(
        `[${description}] BLUNDER: ${piece.type}(${move!.from.row},${move!.from.col})->(${move!.to.row},${move!.to.col}) ` +
        `into capture. Net loss: ${netLoss}. AI score: ${move!.score}, depth: ${move!.searchDepth}`
      );
    }
  }
}

describe("AI Tactical Regression Tests", () => {
  it("should not move cannon into chariot's attack range", () => {
    // Black cannon at (5,3), Red chariot at (9,3) - same column
    // Cannon should not move down the column into chariot's range
    const board: Board = Array(10).fill(null).map(() => Array(9).fill(null));
    board[0][4] = { type: 'general', color: 'black' };
    board[0][3] = { type: 'advisor', color: 'black' };
    board[0][5] = { type: 'advisor', color: 'black' };
    board[9][4] = { type: 'general', color: 'red' };
    board[9][3] = { type: 'advisor', color: 'red' };
    board[9][5] = { type: 'advisor', color: 'red' };
    board[5][3] = { type: 'cannon', color: 'black' };
    board[2][6] = { type: 'horse', color: 'black' };
    board[9][3] = { type: 'chariot', color: 'red' }; // Chariot on same column!
    board[7][7] = { type: 'horse', color: 'red' };
    
    checkNoBlunder(board, 'black', "Cannon vs Chariot same column");
  }, 10000);

  it("should not move horse into chariot's attack range", () => {
    // Black horse at (4,3), Red chariot at (4,8) - same row
    // Horse is NOT on column 4, so not pinned by flying general
    const board: Board = Array(10).fill(null).map(() => Array(9).fill(null));
    board[0][4] = { type: 'general', color: 'black' };
    board[0][3] = { type: 'advisor', color: 'black' };
    board[0][5] = { type: 'advisor', color: 'black' };
    board[9][4] = { type: 'general', color: 'red' };
    board[9][3] = { type: 'advisor', color: 'red' };
    board[9][5] = { type: 'advisor', color: 'red' };
    board[4][3] = { type: 'horse', color: 'black' };
    board[2][1] = { type: 'cannon', color: 'black' };
    board[1][4] = { type: 'elephant', color: 'black' }; // Block flying general
    board[4][8] = { type: 'chariot', color: 'red' };
    board[7][2] = { type: 'cannon', color: 'red' };
    
    checkNoBlunder(board, 'black', "Horse vs Chariot same row");
  }, 10000);

  it("should not move chariot into cannon's capture range", () => {
    // Black chariot at (3,5), Red cannon at (7,5) with a screen at (5,5)
    const board: Board = Array(10).fill(null).map(() => Array(9).fill(null));
    board[0][4] = { type: 'general', color: 'black' };
    board[0][3] = { type: 'advisor', color: 'black' };
    board[0][5] = { type: 'advisor', color: 'black' };
    board[9][4] = { type: 'general', color: 'red' };
    board[9][3] = { type: 'advisor', color: 'red' };
    board[9][5] = { type: 'advisor', color: 'red' };
    board[3][5] = { type: 'chariot', color: 'black' };
    board[2][2] = { type: 'horse', color: 'black' };
    board[7][5] = { type: 'cannon', color: 'red' };
    board[5][5] = { type: 'soldier', color: 'red' }; // Screen for cannon
    board[7][0] = { type: 'chariot', color: 'red' };
    
    checkNoBlunder(board, 'black', "Chariot vs Cannon with screen");
  }, 10000);

  it("should not move cannon to back rank where chariot guards", () => {
    // Simulates the reported blunder: cannon moving to row 9 where chariot can capture
    const board: Board = Array(10).fill(null).map(() => Array(9).fill(null));
    board[0][4] = { type: 'general', color: 'black' };
    board[0][3] = { type: 'advisor', color: 'black' };
    board[0][5] = { type: 'advisor', color: 'black' };
    board[0][2] = { type: 'elephant', color: 'black' };
    board[0][6] = { type: 'elephant', color: 'black' };
    board[9][4] = { type: 'general', color: 'red' };
    board[9][3] = { type: 'advisor', color: 'red' };
    board[9][5] = { type: 'advisor', color: 'red' };
    
    // Black cannon on row 6, column 1 (crossed river)
    board[6][1] = { type: 'cannon', color: 'black' };
    board[2][7] = { type: 'cannon', color: 'black' };
    board[2][2] = { type: 'horse', color: 'black' };
    
    // Red chariot on (9,0) guards the entire back rank
    board[9][0] = { type: 'chariot', color: 'red' };
    board[7][6] = { type: 'horse', color: 'red' };
    board[8][4] = { type: 'cannon', color: 'red' };
    
    // Soldiers
    board[3][0] = { type: 'soldier', color: 'black' };
    board[3][4] = { type: 'soldier', color: 'black' };
    board[6][4] = { type: 'soldier', color: 'red' };
    board[6][6] = { type: 'soldier', color: 'red' };
    
    checkNoBlunder(board, 'black', "Cannon to back rank with chariot");
  }, 10000);

  it("should not move horse to square attacked by cannon", () => {
    const board: Board = Array(10).fill(null).map(() => Array(9).fill(null));
    board[0][4] = { type: 'general', color: 'black' };
    board[0][3] = { type: 'advisor', color: 'black' };
    board[0][5] = { type: 'advisor', color: 'black' };
    board[9][4] = { type: 'general', color: 'red' };
    board[9][3] = { type: 'advisor', color: 'red' };
    board[9][5] = { type: 'advisor', color: 'red' };
    
    board[3][3] = { type: 'horse', color: 'black' };
    board[2][0] = { type: 'chariot', color: 'black' };
    board[7][1] = { type: 'cannon', color: 'red' }; // Can capture via screen
    board[5][1] = { type: 'soldier', color: 'red' }; // Screen for cannon
    board[7][7] = { type: 'chariot', color: 'red' };
    
    checkNoBlunder(board, 'black', "Horse vs Cannon with screen");
  }, 10000);

  it("should protect hanging pieces rather than ignore threats", () => {
    // Black horse at (5,5) is attacked by Red chariot at (5,8)
    // AI should move the horse to safety
    const board: Board = Array(10).fill(null).map(() => Array(9).fill(null));
    board[0][4] = { type: 'general', color: 'black' };
    board[0][3] = { type: 'advisor', color: 'black' };
    board[0][5] = { type: 'advisor', color: 'black' };
    board[9][4] = { type: 'general', color: 'red' };
    board[9][3] = { type: 'advisor', color: 'red' };
    board[9][5] = { type: 'advisor', color: 'red' };
    
    board[5][5] = { type: 'horse', color: 'black' }; // Under attack!
    board[2][1] = { type: 'cannon', color: 'black' };
    board[3][0] = { type: 'chariot', color: 'black' }; // Black has a chariot too
    board[5][8] = { type: 'chariot', color: 'red' }; // Attacking the horse
    board[8][3] = { type: 'cannon', color: 'red' };
    
    resetMoveCounter();
    const move = getBestMove(board, 'black', 'hard');
    expect(move).not.toBeNull();
    
    // AI should move the horse (from 5,5) to escape
    // Or use another piece to block/counterattack
    const movedHorse = move!.from.row === 5 && move!.from.col === 5;
    
    if (!movedHorse) {
      // If AI didn't move the horse, check that the horse is now safe
      const newBoard = board.map(r => [...r]) as Board;
      const piece = newBoard[move!.from.row][move!.from.col];
      newBoard[move!.to.row][move!.to.col] = piece;
      newBoard[move!.from.row][move!.from.col] = null;
      
      const redMoves = getAllValidMoves(newBoard, 'red');
      const canCaptureHorse = redMoves.some(m => m.to.row === 5 && m.to.col === 5);
      // If horse still attacked, AI must have a good reason (counterattack)
      if (canCaptureHorse) {
        expect(move!.score).toBeGreaterThan(-100);
      }
    }
    
    // AI should not be losing material in this position (roughly equal)
    expect(move!.score).toBeGreaterThan(-600);
  }, 10000);
});
