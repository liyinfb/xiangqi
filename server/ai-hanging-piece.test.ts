import { describe, it, expect, beforeEach } from 'vitest';
import { getBestMove, resetSearchState } from "../client/src/lib/ai";
import { Board, PieceColor, getAllValidMoves, isInCheck } from "../client/src/lib/xiangqi";

/**
 * Regression tests for the hanging piece safety fix.
 * These tests verify that the AI never moves a piece to a square
 * where it can be captured for free (送子 blunder).
 * 
 * Two fixes were applied:
 * 1. Evaluation function now penalizes hanging pieces (40% of piece value)
 * 2. Opening randomization filters out moves that hang pieces
 */

const PIECE_VAL: Record<string, number> = {
  general: 100000, advisor: 200, elephant: 200, horse: 480, chariot: 1000, cannon: 510, soldier: 100,
};

function createBoard(pieces: { row: number; col: number; type: any; color: PieceColor }[]): Board {
  const board: Board = Array.from({ length: 10 }, () => Array(9).fill(null));
  for (const p of pieces) {
    board[p.row][p.col] = { type: p.type, color: p.color };
  }
  return board;
}

function assertNoFreeCapture(board: Board, color: PieceColor, description: string): void {
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
  
  if (canBeCaptured && piece) {
    const movedValue = PIECE_VAL[piece.type];
    const capturedValue = captured ? PIECE_VAL[captured.type] : 0;
    const netLoss = movedValue - capturedValue;
    
    // Allow if: gives check, or piece was already attacked, or net loss is small
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

describe("AI Hanging Piece Safety Tests", () => {
  beforeEach(() => {
    resetSearchState();
  });

  // Regression test for IMG_5506.PNG screenshot bug:
  // Black cannon should not move to a square where red chariot can capture it
  it("should not move cannon into chariot's column (screenshot regression)", () => {
    // Position approximating the screenshot: black cannon can reach a square
    // on the same column as red chariot with no blocking pieces
    const board = createBoard([
      { row: 0, col: 0, type: 'chariot', color: 'black' },
      { row: 0, col: 2, type: 'elephant', color: 'black' },
      { row: 0, col: 3, type: 'advisor', color: 'black' },
      { row: 0, col: 4, type: 'general', color: 'black' },
      { row: 0, col: 5, type: 'advisor', color: 'black' },
      { row: 0, col: 6, type: 'elephant', color: 'black' },
      { row: 0, col: 8, type: 'chariot', color: 'black' },
      { row: 2, col: 0, type: 'cannon', color: 'black' },
      { row: 2, col: 2, type: 'horse', color: 'black' },
      { row: 2, col: 5, type: 'horse', color: 'black' },
      { row: 2, col: 6, type: 'cannon', color: 'black' },
      { row: 3, col: 0, type: 'soldier', color: 'black' },
      { row: 3, col: 2, type: 'soldier', color: 'black' },
      { row: 3, col: 4, type: 'soldier', color: 'black' },
      { row: 3, col: 6, type: 'soldier', color: 'black' },
      { row: 3, col: 8, type: 'soldier', color: 'black' },
      // Red pieces
      { row: 9, col: 4, type: 'general', color: 'red' },
      { row: 9, col: 3, type: 'advisor', color: 'red' },
      { row: 9, col: 5, type: 'advisor', color: 'red' },
      { row: 9, col: 0, type: 'chariot', color: 'red' },
      { row: 9, col: 8, type: 'chariot', color: 'red' },
      { row: 7, col: 1, type: 'cannon', color: 'red' },
      { row: 7, col: 2, type: 'horse', color: 'red' },
      { row: 7, col: 4, type: 'cannon', color: 'red' },
      { row: 7, col: 6, type: 'horse', color: 'red' },
      { row: 6, col: 0, type: 'soldier', color: 'red' },
      { row: 6, col: 3, type: 'soldier', color: 'red' },
      { row: 5, col: 1, type: 'soldier', color: 'red' },
      { row: 6, col: 4, type: 'soldier', color: 'red' },
      { row: 6, col: 8, type: 'soldier', color: 'red' },
    ]);
    
    assertNoFreeCapture(board, 'black', "Cannon into chariot column (screenshot)");
  }, 15000);

  // Test that cannon doesn't move into chariot's row
  it("should not move cannon into chariot's row", () => {
    const board = createBoard([
      { row: 0, col: 4, type: 'general', color: 'black' },
      { row: 0, col: 3, type: 'advisor', color: 'black' },
      { row: 0, col: 5, type: 'advisor', color: 'black' },
      { row: 5, col: 3, type: 'cannon', color: 'black' },
      { row: 2, col: 1, type: 'horse', color: 'black' },
      { row: 3, col: 0, type: 'soldier', color: 'black' },
      { row: 3, col: 4, type: 'soldier', color: 'black' },
      { row: 9, col: 4, type: 'general', color: 'red' },
      { row: 9, col: 3, type: 'advisor', color: 'red' },
      { row: 9, col: 5, type: 'advisor', color: 'red' },
      { row: 5, col: 8, type: 'chariot', color: 'red' },
      { row: 7, col: 1, type: 'cannon', color: 'red' },
    ]);
    
    assertNoFreeCapture(board, 'black', "Cannon into chariot row");
  }, 15000);

  // Test that horse doesn't jump to a square attacked by chariot
  it("should not move horse to square attacked by chariot", () => {
    const board = createBoard([
      { row: 0, col: 4, type: 'general', color: 'black' },
      { row: 0, col: 3, type: 'advisor', color: 'black' },
      { row: 0, col: 5, type: 'advisor', color: 'black' },
      { row: 3, col: 4, type: 'horse', color: 'black' },
      { row: 2, col: 1, type: 'cannon', color: 'black' },
      { row: 3, col: 0, type: 'soldier', color: 'black' },
      { row: 9, col: 4, type: 'general', color: 'red' },
      { row: 9, col: 3, type: 'advisor', color: 'red' },
      { row: 9, col: 5, type: 'advisor', color: 'red' },
      { row: 9, col: 6, type: 'chariot', color: 'red' },
      { row: 7, col: 7, type: 'cannon', color: 'red' },
    ]);
    
    assertNoFreeCapture(board, 'black', "Horse into chariot attack");
  }, 15000);

  // Run the test multiple times to account for randomization
  it("should never blunder across 5 runs with randomization", () => {
    // Position where cannon could move to chariot's line
    const board = createBoard([
      { row: 0, col: 4, type: 'general', color: 'black' },
      { row: 0, col: 3, type: 'advisor', color: 'black' },
      { row: 0, col: 5, type: 'advisor', color: 'black' },
      { row: 0, col: 2, type: 'elephant', color: 'black' },
      { row: 0, col: 6, type: 'elephant', color: 'black' },
      { row: 6, col: 1, type: 'cannon', color: 'black' },
      { row: 2, col: 7, type: 'cannon', color: 'black' },
      { row: 2, col: 2, type: 'horse', color: 'black' },
      { row: 3, col: 0, type: 'soldier', color: 'black' },
      { row: 3, col: 4, type: 'soldier', color: 'black' },
      { row: 9, col: 4, type: 'general', color: 'red' },
      { row: 9, col: 3, type: 'advisor', color: 'red' },
      { row: 9, col: 5, type: 'advisor', color: 'red' },
      { row: 9, col: 0, type: 'chariot', color: 'red' },
      { row: 7, col: 6, type: 'horse', color: 'red' },
      { row: 8, col: 4, type: 'cannon', color: 'red' },
      { row: 6, col: 4, type: 'soldier', color: 'red' },
      { row: 6, col: 6, type: 'soldier', color: 'red' },
    ]);
    
    // Run 5 times (each resets state, so moveCounter=0 triggers randomization)
    for (let i = 0; i < 5; i++) {
      resetSearchState();
      assertNoFreeCapture(board, 'black', `Randomization safety run ${i+1}`);
    }
  }, 60000);
});
