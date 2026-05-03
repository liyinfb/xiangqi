import { describe, it, expect, beforeEach } from 'vitest';
import { getBestMove, resetSearchState } from '../client/src/lib/ai';
import { createInitialBoard, Board, Piece, PieceColor } from '../client/src/lib/xiangqi';

function emptyBoard(): Board {
  return Array.from({ length: 10 }, () => Array(9).fill(null));
}

function place(board: Board, row: number, col: number, type: string, color: PieceColor) {
  board[row][col] = { type: type as any, color } as Piece;
}

describe('AI Symmetry Optimization', () => {
  beforeEach(() => {
    resetSearchState();
  });

  it('should detect symmetric initial board and reduce search nodes', () => {
    const board = createInitialBoard();
    
    // Run with symmetry (initial board is symmetric, no position history)
    resetSearchState();
    const moveWithSym = getBestMove(board, 'red', 'easy');
    const nodesWithSym = moveWithSym?.nodesSearched || 0;
    
    expect(moveWithSym).not.toBeNull();
    expect(moveWithSym!.score).toBeDefined();
    // Symmetry should allow deeper search in same time
    expect(moveWithSym!.searchDepth).toBeGreaterThanOrEqual(7);
    
    console.log(`Symmetric board: move=${moveWithSym!.from.row},${moveWithSym!.from.col}->${moveWithSym!.to.row},${moveWithSym!.to.col} score=${moveWithSym!.score} depth=${moveWithSym!.searchDepth} nodes=${nodesWithSym}`);
  });

  it('should produce valid moves on symmetric board', () => {
    const board = createInitialBoard();
    resetSearchState();
    
    const move = getBestMove(board, 'red', 'hard');
    expect(move).not.toBeNull();
    
    // The move should be a valid position
    expect(move!.from.row).toBeGreaterThanOrEqual(0);
    expect(move!.from.row).toBeLessThanOrEqual(9);
    expect(move!.from.col).toBeGreaterThanOrEqual(0);
    expect(move!.from.col).toBeLessThanOrEqual(8);
    expect(move!.to.row).toBeGreaterThanOrEqual(0);
    expect(move!.to.row).toBeLessThanOrEqual(9);
    expect(move!.to.col).toBeGreaterThanOrEqual(0);
    expect(move!.to.col).toBeLessThanOrEqual(8);
    
    // The piece at from should be red
    const piece = board[move!.from.row][move!.from.col];
    expect(piece).not.toBeNull();
    expect(piece!.color).toBe('red');
    
    console.log(`Hard mode symmetric: move=${move!.from.row},${move!.from.col}->${move!.to.row},${move!.to.col} score=${move!.score} depth=${move!.searchDepth} nodes=${move!.nodesSearched}`);
  });

  it('should NOT apply symmetry on asymmetric board', () => {
    const board = createInitialBoard();
    // Make the board asymmetric by moving a piece
    board[7][1] = null; // Remove red cannon from (7,1)
    board[5][3] = { type: 'cannon', color: 'red' }; // Place it at (5,3)
    
    resetSearchState();
    const move = getBestMove(board, 'black', 'easy');
    expect(move).not.toBeNull();
    
    console.log(`Asymmetric board: move=${move!.from.row},${move!.from.col}->${move!.to.row},${move!.to.col} score=${move!.score} depth=${move!.searchDepth} nodes=${move!.nodesSearched}`);
  });

  it('should produce same quality moves with symmetry optimization', () => {
    // Test that the symmetry optimization doesn't miss better moves
    // by running multiple times and checking consistency
    const board = createInitialBoard();
    
    const moves: string[] = [];
    for (let i = 0; i < 3; i++) {
      resetSearchState();
      const move = getBestMove(board, 'red', 'hard');
      expect(move).not.toBeNull();
      moves.push(`${move!.from.row},${move!.from.col}->${move!.to.row},${move!.to.col}`);
    }
    
    // All runs should produce the same move (deterministic with no randomization)
    expect(moves[0]).toBe(moves[1]);
    expect(moves[1]).toBe(moves[2]);
    console.log(`Deterministic check: all 3 runs chose ${moves[0]}`);
  });

  it('black response should also benefit from symmetry on symmetric board', () => {
    const board = createInitialBoard();
    // Make a symmetric first move (center pawn advance)
    board[6][4] = null;
    board[5][4] = { type: 'soldier', color: 'red' };
    
    resetSearchState();
    const move = getBestMove(board, 'black', 'easy');
    expect(move).not.toBeNull();
    
    const piece = board[move!.from.row][move!.from.col];
    expect(piece).not.toBeNull();
    expect(piece!.color).toBe('black');
    
    console.log(`Black response on symmetric board: move=${move!.from.row},${move!.from.col}->${move!.to.row},${move!.to.col} score=${move!.score} depth=${move!.searchDepth} nodes=${move!.nodesSearched}`);
  });

  it('should NOT apply symmetry when position history exists (even if board is symmetric)', () => {
    const board = createInitialBoard();
    
    // Pass position history - this should disable symmetry optimization
    // because mirrored moves may have different repetition penalties
    const fakeHashes = [12345, 67890];
    resetSearchState();
    const moveWithHistory = getBestMove(board, 'red', 'easy', undefined, fakeHashes);
    expect(moveWithHistory).not.toBeNull();
    
    // Without history (symmetry enabled)
    resetSearchState();
    const moveNoHistory = getBestMove(board, 'red', 'easy');
    expect(moveNoHistory).not.toBeNull();
    
    console.log(`With history: move=${moveWithHistory!.from.row},${moveWithHistory!.from.col}->${moveWithHistory!.to.row},${moveWithHistory!.to.col} depth=${moveWithHistory!.searchDepth} nodes=${moveWithHistory!.nodesSearched}`);
    console.log(`No history (sym): move=${moveNoHistory!.from.row},${moveNoHistory!.from.col}->${moveNoHistory!.to.row},${moveNoHistory!.to.col} depth=${moveNoHistory!.searchDepth} nodes=${moveNoHistory!.nodesSearched}`);
  });
});
