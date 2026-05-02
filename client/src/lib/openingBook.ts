// Chinese Chess Opening Book
// Contains classic openings for both red and black sides
// Format: board hash -> list of candidate moves with weights

import { Board, PieceColor, Position } from './xiangqi';

interface BookMove {
  from: Position;
  to: Position;
  weight: number; // Higher weight = more likely to be chosen
  name?: string;  // Opening name for display
}

interface BookEntry {
  moves: BookMove[];
}

// Simple board fingerprint for opening book lookup
// Only considers piece positions (not full Zobrist) for portability
function getBoardFingerprint(board: Board): string {
  let fp = '';
  for (let r = 0; r < 10; r++) {
    for (let c = 0; c < 9; c++) {
      const p = board[r][c];
      if (p) {
        fp += `${r}${c}${p.color[0]}${p.type[0]}`;
      }
    }
  }
  return fp;
}

// Opening book entries
// Key: board fingerprint at that position
// Value: list of recommended moves with weights
const openingBook: Map<string, BookEntry> = new Map();

// Helper to create a position
function pos(row: number, col: number): Position {
  return { row, col };
}

// ============================================================
// BLACK RESPONSES (AI plays black)
// ============================================================

// After Red's first move: 炮二平五 (Cannon to center - 中炮)
// Red cannon from (7,7) to (7,4) - Central Cannon opening
// Black responses:
function initOpeningBook() {
  // --- INITIAL POSITION: Black's first move responses ---
  
  // Initial board fingerprint
  const initialFP = getInitialFingerprint();
  
  // Red opening moves (if AI plays red, which it doesn't currently, but for completeness)
  // Not needed since AI plays black
  
  // --- After common Red openings, Black responses ---
  
  // We'll use a simpler approach: track move sequences rather than board states
  // This avoids computing fingerprints for every possible board state
}

// Instead of fingerprint-based lookup, use move-sequence based opening book
// This is more practical and covers the most common lines

export interface OpeningMove {
  from: Position;
  to: Position;
  name: string;
}

// Move sequence based opening book for Black (AI)
// Key: serialized move history (e.g., "7,7->7,4" for red's first move)
// Value: list of candidate responses
interface SequenceBookEntry {
  moves: OpeningMove[];
  weights: number[];
}

function moveKey(from: Position, to: Position): string {
  return `${from.row},${from.col}->${to.row},${to.col}`;
}

function historyKey(moves: { from: Position; to: Position }[]): string {
  return moves.map(m => moveKey(m.from, m.to)).join('|');
}

// The opening book maps move history sequences to candidate responses
const sequenceBook: Map<string, SequenceBookEntry> = new Map();

// ============================================================
// Populate the opening book with classic openings
// ============================================================

// --- Black's response to Red's 1st move ---

// 1. 中炮开局 (Central Cannon): Red plays 炮二平五 (7,7)->(7,4)
sequenceBook.set('7,7->7,4', {
  moves: [
    { from: pos(0, 1), to: pos(2, 2), name: '屏风马' },      // 马8进7
    { from: pos(0, 7), to: pos(2, 6), name: '屏风马' },      // 马2进3  
    { from: pos(2, 7), to: pos(2, 4), name: '中炮对中炮' },   // 炮8平5
    { from: pos(3, 6), to: pos(4, 6), name: '卒7进1' },      // 卒7进1
    { from: pos(0, 1), to: pos(2, 0), name: '单提马' },      // 马8进9
  ],
  weights: [30, 25, 20, 15, 10],
});

// 2. 飞相开局 (Flying Elephant): Red plays 相三进五 (9,2)->(7,4) or 相七进五 (9,6)->(7,4)
sequenceBook.set('9,6->7,4', {
  moves: [
    { from: pos(0, 1), to: pos(2, 2), name: '进马' },        // 马8进7
    { from: pos(2, 1), to: pos(2, 4), name: '中炮' },        // 炮2平5
    { from: pos(3, 4), to: pos(4, 4), name: '进卒' },        // 卒5进1
    { from: pos(0, 7), to: pos(2, 6), name: '进马' },        // 马2进3
  ],
  weights: [30, 30, 20, 20],
});

sequenceBook.set('9,2->7,4', {
  moves: [
    { from: pos(0, 7), to: pos(2, 6), name: '进马' },        // 马2进3
    { from: pos(2, 7), to: pos(2, 4), name: '中炮' },        // 炮8平5
    { from: pos(3, 4), to: pos(4, 4), name: '进卒' },        // 卒5进1
    { from: pos(0, 1), to: pos(2, 2), name: '进马' },        // 马8进7
  ],
  weights: [30, 30, 20, 20],
});

// 3. 仙人指路 (Immortal's Guide): Red plays 兵七进一 (6,6)->(5,6) or 兵三进一 (6,2)->(5,2)
sequenceBook.set('6,6->5,6', {
  moves: [
    { from: pos(3, 2), to: pos(4, 2), name: '卒3进1' },      // 对兵
    { from: pos(0, 1), to: pos(2, 2), name: '马8进7' },      // 进马
    { from: pos(2, 7), to: pos(2, 4), name: '炮8平5' },      // 中炮
    { from: pos(3, 6), to: pos(4, 6), name: '卒7进1' },      // 对兵
  ],
  weights: [30, 25, 25, 20],
});

sequenceBook.set('6,2->5,2', {
  moves: [
    { from: pos(3, 6), to: pos(4, 6), name: '卒7进1' },      // 对兵
    { from: pos(0, 7), to: pos(2, 6), name: '马2进3' },      // 进马
    { from: pos(2, 1), to: pos(2, 4), name: '炮2平5' },      // 中炮
    { from: pos(3, 2), to: pos(4, 2), name: '卒3进1' },      // 对兵
  ],
  weights: [30, 25, 25, 20],
});

// 4. 起马局 (Horse Opening): Red plays 马二进三 (9,7)->(7,6) or 马八进七 (9,1)->(7,2)
sequenceBook.set('9,7->7,6', {
  moves: [
    { from: pos(0, 1), to: pos(2, 2), name: '马8进7' },      // 进马
    { from: pos(3, 6), to: pos(4, 6), name: '卒7进1' },      // 进卒
    { from: pos(2, 7), to: pos(2, 4), name: '炮8平5' },      // 中炮
    { from: pos(0, 7), to: pos(2, 6), name: '马2进3' },      // 进马
  ],
  weights: [30, 25, 25, 20],
});

sequenceBook.set('9,1->7,2', {
  moves: [
    { from: pos(0, 7), to: pos(2, 6), name: '马2进3' },      // 进马
    { from: pos(3, 2), to: pos(4, 2), name: '卒3进1' },      // 进卒
    { from: pos(2, 1), to: pos(2, 4), name: '炮2平5' },      // 中炮
    { from: pos(0, 1), to: pos(2, 2), name: '马8进7' },      // 进马
  ],
  weights: [30, 25, 25, 20],
});

// 5. 过宫炮 (Palace Cannon): Red plays 炮二平六 (7,7)->(7,3)
sequenceBook.set('7,7->7,3', {
  moves: [
    { from: pos(0, 7), to: pos(2, 6), name: '马2进3' },      // 进马
    { from: pos(2, 7), to: pos(2, 4), name: '炮8平5' },      // 中炮
    { from: pos(0, 1), to: pos(2, 2), name: '马8进7' },      // 进马
  ],
  weights: [35, 35, 30],
});

// 6. 士角炮 (Advisor-Corner Cannon): Red plays 炮二平四 (7,7)->(7,5)
sequenceBook.set('7,7->7,5', {
  moves: [
    { from: pos(0, 1), to: pos(2, 2), name: '马8进7' },
    { from: pos(0, 7), to: pos(2, 6), name: '马2进3' },
    { from: pos(2, 1), to: pos(2, 4), name: '炮2平5' },
  ],
  weights: [35, 35, 30],
});

// --- Black's 2nd move responses (after common sequences) ---

// After 中炮 + 屏风马: Red 马二进三 (9,7)->(7,6)
sequenceBook.set('7,7->7,4|0,1->2,2|9,7->7,6', {
  moves: [
    { from: pos(0, 7), to: pos(2, 6), name: '双马防御' },    // 马2进3
    { from: pos(3, 2), to: pos(4, 2), name: '卒3进1' },      // 进卒
  ],
  weights: [60, 40],
});

// After 中炮 + 屏风马: Red 马八进七 (9,1)->(7,2)
sequenceBook.set('7,7->7,4|0,7->2,6|9,1->7,2', {
  moves: [
    { from: pos(0, 1), to: pos(2, 2), name: '双马防御' },    // 马8进7
    { from: pos(3, 6), to: pos(4, 6), name: '卒7进1' },      // 进卒
  ],
  weights: [60, 40],
});

// After 中炮 + 屏风马(左): Red 车一进一 (9,8)->(8,8)
sequenceBook.set('7,7->7,4|0,1->2,2|9,8->8,8', {
  moves: [
    { from: pos(0, 0), to: pos(1, 0), name: '车9进1' },      // 出车
    { from: pos(0, 7), to: pos(2, 6), name: '马2进3' },      // 进马
  ],
  weights: [55, 45],
});

// After 中炮 + 屏风马(右): Red 车九进一 (9,0)->(8,0)
sequenceBook.set('7,7->7,4|0,7->2,6|9,0->8,0', {
  moves: [
    { from: pos(0, 8), to: pos(1, 8), name: '车1进1' },      // 出车
    { from: pos(0, 1), to: pos(2, 2), name: '马8进7' },      // 进马
  ],
  weights: [55, 45],
});

// After 仙人指路 + 对兵: Red 炮二平五 (7,7)->(7,4)
sequenceBook.set('6,6->5,6|3,2->4,2|7,7->7,4', {
  moves: [
    { from: pos(0, 1), to: pos(2, 2), name: '马8进7' },
    { from: pos(0, 7), to: pos(2, 6), name: '马2进3' },
  ],
  weights: [50, 50],
});

// After 飞相 + 进马: Red 马八进七 (9,1)->(7,2)
sequenceBook.set('9,6->7,4|0,1->2,2|9,1->7,2', {
  moves: [
    { from: pos(2, 1), to: pos(2, 4), name: '炮2平5' },     // 中炮
    { from: pos(0, 7), to: pos(2, 6), name: '马2进3' },     // 进马
    { from: pos(3, 6), to: pos(4, 6), name: '卒7进1' },     // 进卒
  ],
  weights: [40, 35, 25],
});

// --- Black's 3rd move responses ---

// 中炮 屏风马 双马: Red 车一平二 (9,8)->(9,7) or similar
sequenceBook.set('7,7->7,4|0,1->2,2|9,7->7,6|0,7->2,6', {
  moves: [
    { from: pos(0, 0), to: pos(1, 0), name: '车9进1' },      // 出车
    { from: pos(3, 2), to: pos(4, 2), name: '卒3进1' },      // 进卒
    { from: pos(0, 8), to: pos(1, 8), name: '车1进1' },      // 出车
  ],
  weights: [40, 35, 25],
});

// ============================================================
// Lookup function
// ============================================================

export function lookupOpeningBook(
  moveHistory: { from: Position; to: Position }[],
  aiColor: PieceColor
): OpeningMove | null {
  // Only use opening book for first 6 moves (3 pairs)
  if (moveHistory.length > 6) return null;
  
  // Build the history key from all moves so far
  const key = historyKey(moveHistory);
  
  const entry = sequenceBook.get(key);
  if (!entry || entry.moves.length === 0) return null;
  
  // Weighted random selection
  const totalWeight = entry.weights.reduce((a, b) => a + b, 0);
  let rand = Math.random() * totalWeight;
  
  for (let i = 0; i < entry.moves.length; i++) {
    rand -= entry.weights[i];
    if (rand <= 0) {
      return entry.moves[i];
    }
  }
  
  return entry.moves[0];
}

export function getOpeningName(
  moveHistory: { from: Position; to: Position }[]
): string | null {
  // Check if the last move came from the opening book
  const key = historyKey(moveHistory.slice(0, -1));
  const entry = sequenceBook.get(key);
  if (!entry) return null;
  
  const lastMove = moveHistory[moveHistory.length - 1];
  const bookMove = entry.moves.find(
    m => m.from.row === lastMove.from.row && m.from.col === lastMove.from.col &&
         m.to.row === lastMove.to.row && m.to.col === lastMove.to.col
  );
  
  return bookMove?.name || null;
}

function getInitialFingerprint(): string {
  // Not used in sequence-based approach
  return '';
}
