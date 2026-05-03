/**
 * Test: SearchStats interface and data flow
 * Verifies that the SearchStats type is correctly structured and that
 * the AI engine returns the necessary data for the stats panel.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { createInitialBoard, makeMove } from '../client/src/lib/xiangqi';
import { getBestMove, resetSearchState, AIMove } from '../client/src/lib/ai';

describe('Search Statistics Data', () => {
  beforeEach(() => {
    resetSearchState();
  });

  it('getBestMove returns nodesSearched for stats tracking', () => {
    const board = createInitialBoard();
    const result = getBestMove(board, 'black', 'medium');
    
    expect(result).not.toBeNull();
    expect(result!.searchDepth).toBeGreaterThan(0);
    expect(result!.nodesSearched).toBeDefined();
    expect(result!.nodesSearched).toBeGreaterThan(0);
    expect(typeof result!.score).toBe('number');
  });

  it('opening book moves return depth 0 and nodes 0', () => {
    const board = createInitialBoard();
    // With move history, the engine should use opening book
    const moveHistory = [{ from: { row: 6, col: 4 }, to: { row: 5, col: 4 } }]; // e4
    const result = getBestMove(board, 'black', 'hard', undefined, undefined, moveHistory);
    
    // Book move or search - either way it should have valid structure
    expect(result).not.toBeNull();
    expect(typeof result!.searchDepth).toBe('number');
    expect(typeof result!.score).toBe('number');
    if (result!.searchDepth === 0) {
      // Book move
      expect(result!.nodesSearched).toBe(0);
    } else {
      // Search move
      expect(result!.nodesSearched).toBeGreaterThan(0);
    }
  });

  it('NPS can be calculated from nodes and time', () => {
    const board = createInitialBoard();
    const start = Date.now();
    const result = getBestMove(board, 'black', 'easy');
    const elapsed = Date.now() - start;
    
    expect(result).not.toBeNull();
    if (result!.searchDepth > 0 && elapsed > 0) {
      const nps = Math.round(result!.nodesSearched! / (elapsed / 1000));
      expect(nps).toBeGreaterThan(0);
      expect(nps).toBeLessThan(10000000); // Sanity check: less than 10M NPS
    }
  });

  it('stats differ between difficulty levels', () => {
    const board = createInitialBoard();
    
    resetSearchState();
    const easyResult = getBestMove(board, 'black', 'easy');
    
    resetSearchState();
    const hardResult = getBestMove(board, 'black', 'hard');
    
    expect(easyResult).not.toBeNull();
    expect(hardResult).not.toBeNull();
    
    // Hard mode should search deeper
    expect(hardResult!.searchDepth).toBeGreaterThanOrEqual(easyResult!.searchDepth);
    // Hard mode should search more nodes
    expect(hardResult!.nodesSearched!).toBeGreaterThan(easyResult!.nodesSearched!);
  });
});
