/**
 * Diagnostic: Check if easy mode search depth is realistic
 * Easy mode has 2s time limit. Opening positions should NOT reach depth 12-13 in 2s.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { createInitialBoard, makeMove } from '../client/src/lib/xiangqi';
import { getBestMove, resetSearchState, AIMove } from '../client/src/lib/ai';

describe('Easy mode depth diagnostic', () => {
  beforeEach(() => {
    resetSearchState();
  });

  it('easy mode opening: check depth and time', () => {
    const board = createInitialBoard();
    const start = Date.now();
    const result = getBestMove(board, 'red', 'easy');
    const elapsed = Date.now() - start;
    
    console.log(`Easy mode opening: depth=${result?.searchDepth}, nodes=${result?.nodesSearched}, time=${elapsed}ms`);
    
    expect(result).not.toBeNull();
    // Easy mode should NOT reach depth 12+ in 2s for opening
    // Typical expectation: depth 6-9 for easy mode
    expect(elapsed).toBeLessThanOrEqual(3000); // Should respect ~2s limit
  });

  it('easy mode after a few moves: check depth', () => {
    let board = createInitialBoard();
    // Make a few moves to get past opening book
    const moves = [
      { from: { row: 6, col: 4 }, to: { row: 5, col: 4 } }, // red pawn e4
      { from: { row: 3, col: 4 }, to: { row: 4, col: 4 } }, // black pawn e5
      { from: { row: 7, col: 1 }, to: { row: 4, col: 1 } }, // red cannon
      { from: { row: 0, col: 1 }, to: { row: 2, col: 2 } }, // black horse
      { from: { row: 9, col: 1 }, to: { row: 9, col: 4 } }, // red horse
      { from: { row: 2, col: 1 }, to: { row: 2, col: 4 } }, // black cannon
    ];
    for (const m of moves) {
      const result = makeMove(board, m.from, m.to);
      board = result.newBoard;
    }
    
    resetSearchState();
    const start = Date.now();
    const result = getBestMove(board, 'red', 'easy');
    const elapsed = Date.now() - start;
    
    console.log(`Easy mode mid-opening: depth=${result?.searchDepth}, nodes=${result?.nodesSearched}, time=${elapsed}ms`);
    
    expect(result).not.toBeNull();
    expect(elapsed).toBeLessThanOrEqual(3000);
  });

  it('medium mode opening: check depth and time', () => {
    const board = createInitialBoard();
    const start = Date.now();
    const result = getBestMove(board, 'red', 'medium');
    const elapsed = Date.now() - start;
    
    console.log(`Medium mode opening: depth=${result?.searchDepth}, nodes=${result?.nodesSearched}, time=${elapsed}ms`);
    
    expect(result).not.toBeNull();
    expect(elapsed).toBeLessThanOrEqual(6000);
  });

  it('hard mode opening: check depth and time', () => {
    const board = createInitialBoard();
    const start = Date.now();
    const result = getBestMove(board, 'red', 'hard');
    const elapsed = Date.now() - start;
    
    console.log(`Hard mode opening: depth=${result?.searchDepth}, nodes=${result?.nodesSearched}, time=${elapsed}ms`);
    
    expect(result).not.toBeNull();
    expect(elapsed).toBeLessThanOrEqual(10000);
  });

  it('compare all difficulties on same position', () => {
    let board = createInitialBoard();
    // A position past opening book
    const moves = [
      { from: { row: 6, col: 4 }, to: { row: 5, col: 4 } },
      { from: { row: 3, col: 4 }, to: { row: 4, col: 4 } },
      { from: { row: 9, col: 1 }, to: { row: 7, col: 2 } },
      { from: { row: 0, col: 1 }, to: { row: 2, col: 2 } },
    ];
    for (const m of moves) {
      const result = makeMove(board, m.from, m.to);
      board = result.newBoard;
    }

    const results: Record<string, { depth: number; nodes: number; time: number }> = {};
    
    for (const diff of ['easy', 'medium', 'hard'] as const) {
      resetSearchState();
      const start = Date.now();
      const result = getBestMove(board, 'red', diff);
      const elapsed = Date.now() - start;
      results[diff] = {
        depth: result?.searchDepth || 0,
        nodes: result?.nodesSearched || 0,
        time: elapsed,
      };
    }

    console.log('Difficulty comparison on same position:');
    console.log(`  Easy:   depth=${results.easy.depth}, nodes=${results.easy.nodes}, time=${results.easy.time}ms`);
    console.log(`  Medium: depth=${results.medium.depth}, nodes=${results.medium.nodes}, time=${results.medium.time}ms`);
    console.log(`  Hard:   depth=${results.hard.depth}, nodes=${results.hard.nodes}, time=${results.hard.time}ms`);

    // Easy should have lower depth than hard
    expect(results.easy.depth).toBeLessThanOrEqual(results.hard.depth);
    // Easy should search fewer nodes
    expect(results.easy.nodes).toBeLessThan(results.hard.nodes);
  });
});
