/**
 * Benchmark test: Measures the impact of each new optimization on search depth/NPS.
 * 
 * We test 3 positions:
 * 1. Initial board (opening)
 * 2. Midgame position (14 pieces)
 * 3. Endgame position (5 pieces)
 * 
 * For each position, we run getBestMove with hard mode (8s) and record:
 * - Search depth reached
 * - Nodes searched
 * - Time elapsed
 * - NPS (nodes per second)
 */
import { describe, it, beforeEach, expect } from 'vitest';
import { createInitialBoard, Board, Piece, Position, makeMove } from '../client/src/lib/xiangqi';
import { getBestMove, resetSearchState } from '../client/src/lib/ai';

function emptyBoard(): Board {
  return Array.from({ length: 10 }, () => Array(9).fill(null));
}

function place(board: Board, row: number, col: number, type: Piece['type'], color: Piece['color']) {
  board[row][col] = { type, color, position: { row, col } };
}

// Midgame: 14 pieces, typical after some exchanges
function createMidgameBoard(): Board {
  const b = emptyBoard();
  // Red
  place(b, 9, 4, 'general', 'red');
  place(b, 9, 3, 'advisor', 'red');
  place(b, 9, 5, 'advisor', 'red');
  place(b, 9, 0, 'chariot', 'red');
  place(b, 7, 7, 'cannon', 'red');
  place(b, 6, 4, 'soldier', 'red');
  place(b, 6, 2, 'soldier', 'red');
  // Black
  place(b, 0, 4, 'general', 'black');
  place(b, 0, 3, 'advisor', 'black');
  place(b, 0, 5, 'advisor', 'black');
  place(b, 0, 8, 'chariot', 'black');
  place(b, 2, 1, 'cannon', 'black');
  place(b, 3, 4, 'soldier', 'black');
  place(b, 3, 6, 'soldier', 'black');
  return b;
}

// Endgame: 5 pieces
function createEndgameBoard(): Board {
  const b = emptyBoard();
  place(b, 9, 4, 'general', 'red');
  place(b, 7, 4, 'chariot', 'red');
  place(b, 0, 4, 'general', 'black');
  place(b, 0, 3, 'advisor', 'black');
  place(b, 0, 5, 'advisor', 'black');
  return b;
}

interface BenchResult {
  depth: number;
  nodes: number;
  timeMs: number;
  nps: number;
}

function runBench(board: Board, color: 'red' | 'black', difficulty: 'hard' | 'medium' | 'easy'): BenchResult {
  resetSearchState();
  const t0 = Date.now();
  const result = getBestMove(board, color, difficulty);
  const elapsed = Date.now() - t0;
  return {
    depth: result?.searchDepth || 0,
    nodes: result?.nodesSearched || 0,
    timeMs: elapsed,
    nps: elapsed > 0 ? Math.round((result?.nodesSearched || 0) / (elapsed / 1000)) : 0,
  };
}

describe('Optimization Benchmark', () => {
  it('benchmark all positions with current optimizations', () => {
    const positions = [
      { name: 'Initial (opening)', board: createInitialBoard(), color: 'black' as const },
      { name: 'Midgame (14 pieces)', board: createMidgameBoard(), color: 'black' as const },
      { name: 'Endgame (5 pieces)', board: createEndgameBoard(), color: 'red' as const },
    ];

    console.log('\n=== BENCHMARK: Current Code (All Optimizations Enabled) ===');
    console.log('Position                | Depth | Nodes      | Time(ms) | NPS');
    console.log('------------------------|-------|------------|----------|--------');

    for (const pos of positions) {
      const r = runBench(pos.board, pos.color, 'hard');
      console.log(
        `${pos.name.padEnd(24)}| ${String(r.depth).padEnd(6)}| ${String(r.nodes).padEnd(11)}| ${String(r.timeMs).padEnd(9)}| ${r.nps}`
      );
      expect(r.depth).toBeGreaterThan(0);
    }
  });
});
