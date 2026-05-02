// Chinese Chess Opening Book
// Contains classic openings for both red and black sides
// Format: move-sequence key -> list of candidate moves with weights

import { Board, PieceColor, Position } from './xiangqi';

export interface OpeningMove {
  from: Position;
  to: Position;
  name: string;
}

interface SequenceBookEntry {
  moves: OpeningMove[];
  weights: number[];
}

function pos(row: number, col: number): Position {
  return { row, col };
}

function moveKey(from: Position, to: Position): string {
  return `${from.row},${from.col}->${to.row},${to.col}`;
}

function historyKey(moves: { from: Position; to: Position }[]): string {
  return moves.map(m => moveKey(m.from, m.to)).join('|');
}

const sequenceBook: Map<string, SequenceBookEntry> = new Map();

// ============================================================
// Helper: add an entry and its mirror (swap left/right: col -> 8-col)
// This ensures both left and right variations are covered
// ============================================================
function addEntry(key: string, entry: SequenceBookEntry) {
  sequenceBook.set(key, entry);
}

function mirrorCol(c: number): number { return 8 - c; }

function mirrorMoveKey(k: string): string {
  // "r1,c1->r2,c2" => "r1,8-c1->r2,8-c2"
  return k.replace(/(\d+),(\d+)->(\d+),(\d+)/g, (_m, r1, c1, r2, c2) =>
    `${r1},${mirrorCol(+c1)}->${r2},${mirrorCol(+c2)}`
  );
}

function mirrorEntry(entry: SequenceBookEntry): SequenceBookEntry {
  return {
    moves: entry.moves.map(m => ({
      from: pos(m.from.row, mirrorCol(m.from.col)),
      to: pos(m.to.row, mirrorCol(m.to.col)),
      name: m.name,
    })),
    weights: [...entry.weights],
  };
}

// Add entry + its horizontal mirror (covers both left and right side variations)
function addSymmetric(key: string, entry: SequenceBookEntry) {
  addEntry(key, entry);
  const mKey = key.split('|').map(mirrorMoveKey).join('|');
  if (mKey !== key) {
    addEntry(mKey, mirrorEntry(entry));
  }
}

// ============================================================
// AI AS RED: First move (empty history, AI plays red)
// ============================================================
addEntry('', {
  moves: [
    { from: pos(7, 7), to: pos(7, 4), name: '中炮' },          // 炮二平五
    { from: pos(7, 1), to: pos(7, 4), name: '中炮' },          // 炮八平五
    { from: pos(9, 6), to: pos(7, 4), name: '飞相' },          // 相三进五
    { from: pos(9, 2), to: pos(7, 4), name: '飞相' },          // 相七进五
    { from: pos(6, 6), to: pos(5, 6), name: '仙人指路' },      // 兵七进一
    { from: pos(6, 2), to: pos(5, 2), name: '仙人指路' },      // 兵三进一
    { from: pos(9, 7), to: pos(7, 6), name: '起马' },          // 马二进三
    { from: pos(9, 1), to: pos(7, 2), name: '起马' },          // 马八进七
  ],
  weights: [25, 20, 12, 12, 8, 8, 8, 7],
});

// ============================================================
// AI AS BLACK: Response to Red's 1st move
// ============================================================

// 1. 中炮开局: Red 炮二平五 (7,7)->(7,4)
// addSymmetric also creates the mirror: Red 炮八平五 (7,1)->(7,4)
addSymmetric('7,7->7,4', {
  moves: [
    { from: pos(0, 1), to: pos(2, 2), name: '屏风马' },        // 马8进7
    { from: pos(0, 7), to: pos(2, 6), name: '屏风马' },        // 马2进3
    { from: pos(2, 7), to: pos(2, 4), name: '中炮对中炮' },     // 炮8平5
    { from: pos(3, 6), to: pos(4, 6), name: '卒7进1' },        // 卒7进1
    { from: pos(0, 1), to: pos(2, 0), name: '单提马' },        // 马8进9
  ],
  weights: [30, 25, 20, 15, 10],
});

// 2. 飞相开局: Red 相三进五 (9,6)->(7,4)
addSymmetric('9,6->7,4', {
  moves: [
    { from: pos(0, 1), to: pos(2, 2), name: '进马' },
    { from: pos(2, 1), to: pos(2, 4), name: '中炮' },
    { from: pos(3, 4), to: pos(4, 4), name: '进卒' },
    { from: pos(0, 7), to: pos(2, 6), name: '进马' },
  ],
  weights: [30, 30, 20, 20],
});

// 3. 仙人指路: Red 兵七进一 (6,6)->(5,6)
addSymmetric('6,6->5,6', {
  moves: [
    { from: pos(3, 2), to: pos(4, 2), name: '卒3进1' },        // 对兵
    { from: pos(0, 1), to: pos(2, 2), name: '马8进7' },
    { from: pos(2, 7), to: pos(2, 4), name: '炮8平5' },
    { from: pos(3, 6), to: pos(4, 6), name: '卒7进1' },        // 对兵
  ],
  weights: [30, 25, 25, 20],
});

// 4. 起马局: Red 马二进三 (9,7)->(7,6)
addSymmetric('9,7->7,6', {
  moves: [
    { from: pos(0, 1), to: pos(2, 2), name: '马8进7' },
    { from: pos(3, 6), to: pos(4, 6), name: '卒7进1' },
    { from: pos(2, 7), to: pos(2, 4), name: '炮8平5' },
    { from: pos(0, 7), to: pos(2, 6), name: '马2进3' },
  ],
  weights: [30, 25, 25, 20],
});

// 5. 过宫炮: Red 炮二平六 (7,7)->(7,3)
addSymmetric('7,7->7,3', {
  moves: [
    { from: pos(0, 7), to: pos(2, 6), name: '马2进3' },
    { from: pos(2, 7), to: pos(2, 4), name: '炮8平5' },
    { from: pos(0, 1), to: pos(2, 2), name: '马8进7' },
  ],
  weights: [35, 35, 30],
});

// 6. 士角炮: Red 炮二平四 (7,7)->(7,5)
addSymmetric('7,7->7,5', {
  moves: [
    { from: pos(0, 1), to: pos(2, 2), name: '马8进7' },
    { from: pos(0, 7), to: pos(2, 6), name: '马2进3' },
    { from: pos(2, 1), to: pos(2, 4), name: '炮2平5' },
  ],
  weights: [35, 35, 30],
});

// ============================================================
// AI AS RED: Response to Black's 1st move (AI is red, history has 1 red + 1 black move)
// Key format: "red_move|black_move" — AI needs to respond as red's 2nd move
// ============================================================

// After 中炮 + 屏风马(左): respond with horse or chariot development
addSymmetric('7,7->7,4|0,1->2,2', {
  moves: [
    { from: pos(9, 7), to: pos(7, 6), name: '马二进三' },      // 进右马
    { from: pos(9, 1), to: pos(7, 2), name: '马八进七' },      // 进左马
    { from: pos(9, 8), to: pos(8, 8), name: '车一进一' },      // 出右车
  ],
  weights: [40, 35, 25],
});

// After 中炮 + 屏风马(右)
addSymmetric('7,7->7,4|0,7->2,6', {
  moves: [
    { from: pos(9, 1), to: pos(7, 2), name: '马八进七' },
    { from: pos(9, 7), to: pos(7, 6), name: '马二进三' },
    { from: pos(9, 0), to: pos(8, 0), name: '车九进一' },
  ],
  weights: [40, 35, 25],
});

// After 中炮 + 中炮对中炮
addSymmetric('7,7->7,4|2,7->2,4', {
  moves: [
    { from: pos(9, 7), to: pos(7, 6), name: '马二进三' },
    { from: pos(9, 1), to: pos(7, 2), name: '马八进七' },
  ],
  weights: [55, 45],
});

// After 飞相 + 进马
addSymmetric('9,6->7,4|0,1->2,2', {
  moves: [
    { from: pos(9, 1), to: pos(7, 2), name: '马八进七' },
    { from: pos(9, 7), to: pos(7, 6), name: '马二进三' },
    { from: pos(7, 7), to: pos(7, 4), name: '炮二平五' },
  ],
  weights: [35, 35, 30],
});

// After 仙人指路 + 对兵
addSymmetric('6,6->5,6|3,2->4,2', {
  moves: [
    { from: pos(7, 7), to: pos(7, 4), name: '炮二平五' },
    { from: pos(9, 7), to: pos(7, 6), name: '马二进三' },
    { from: pos(9, 1), to: pos(7, 2), name: '马八进七' },
  ],
  weights: [40, 30, 30],
});

// After 起马 + 进马
addSymmetric('9,7->7,6|0,1->2,2', {
  moves: [
    { from: pos(7, 7), to: pos(7, 4), name: '炮二平五' },
    { from: pos(9, 1), to: pos(7, 2), name: '马八进七' },
    { from: pos(6, 6), to: pos(5, 6), name: '兵七进一' },
  ],
  weights: [40, 35, 25],
});

// ============================================================
// AI AS BLACK: 2nd move responses (after 3 half-moves)
// ============================================================

// After 中炮 + 屏风马(左) + 马二进三
addSymmetric('7,7->7,4|0,1->2,2|9,7->7,6', {
  moves: [
    { from: pos(0, 7), to: pos(2, 6), name: '双马防御' },      // 马2进3
    { from: pos(3, 2), to: pos(4, 2), name: '卒3进1' },        // 进卒
  ],
  weights: [60, 40],
});

// After 中炮 + 屏风马(左) + 马八进七
addSymmetric('7,7->7,4|0,1->2,2|9,1->7,2', {
  moves: [
    { from: pos(0, 7), to: pos(2, 6), name: '双马防御' },      // 马2进3
    { from: pos(0, 0), to: pos(1, 0), name: '车9进1' },        // 出车
  ],
  weights: [55, 45],
});

// After 中炮 + 屏风马(右) + 马八进七
addSymmetric('7,7->7,4|0,7->2,6|9,1->7,2', {
  moves: [
    { from: pos(0, 1), to: pos(2, 2), name: '双马防御' },      // 马8进7
    { from: pos(3, 6), to: pos(4, 6), name: '卒7进1' },        // 进卒
  ],
  weights: [60, 40],
});

// After 中炮 + 屏风马(右) + 马二进三
addSymmetric('7,7->7,4|0,7->2,6|9,7->7,6', {
  moves: [
    { from: pos(0, 1), to: pos(2, 2), name: '双马防御' },      // 马8进7
    { from: pos(0, 8), to: pos(1, 8), name: '车1进1' },        // 出车
  ],
  weights: [55, 45],
});

// After 中炮 + 屏风马(左) + 车一进一
addSymmetric('7,7->7,4|0,1->2,2|9,8->8,8', {
  moves: [
    { from: pos(0, 0), to: pos(1, 0), name: '车9进1' },        // 出车
    { from: pos(0, 7), to: pos(2, 6), name: '马2进3' },        // 进马
  ],
  weights: [55, 45],
});

// After 中炮 + 屏风马(右) + 车九进一
addSymmetric('7,7->7,4|0,7->2,6|9,0->8,0', {
  moves: [
    { from: pos(0, 8), to: pos(1, 8), name: '车1进1' },        // 出车
    { from: pos(0, 1), to: pos(2, 2), name: '马8进7' },        // 进马
  ],
  weights: [55, 45],
});

// After 仙人指路 + 对兵 + 中炮
addSymmetric('6,6->5,6|3,2->4,2|7,7->7,4', {
  moves: [
    { from: pos(0, 1), to: pos(2, 2), name: '马8进7' },
    { from: pos(0, 7), to: pos(2, 6), name: '马2进3' },
  ],
  weights: [50, 50],
});

// After 飞相 + 进马 + 马八进七
addSymmetric('9,6->7,4|0,1->2,2|9,1->7,2', {
  moves: [
    { from: pos(2, 1), to: pos(2, 4), name: '炮2平5' },
    { from: pos(0, 7), to: pos(2, 6), name: '马2进3' },
    { from: pos(3, 6), to: pos(4, 6), name: '卒7进1' },
  ],
  weights: [40, 35, 25],
});

// After 飞相 + 中炮 + 马八进七
addSymmetric('9,6->7,4|2,1->2,4|9,1->7,2', {
  moves: [
    { from: pos(0, 1), to: pos(2, 2), name: '马8进7' },
    { from: pos(0, 7), to: pos(2, 6), name: '马2进3' },
  ],
  weights: [50, 50],
});

// ============================================================
// AI AS BLACK: 3rd move responses (after 5 half-moves)
// ============================================================

// 中炮 + 屏风马(左) + 马二进三 + 双马 + 车一平二
addSymmetric('7,7->7,4|0,1->2,2|9,7->7,6|0,7->2,6|9,8->9,7', {
  moves: [
    { from: pos(0, 0), to: pos(1, 0), name: '车9进1' },
    { from: pos(3, 2), to: pos(4, 2), name: '卒3进1' },
    { from: pos(0, 8), to: pos(1, 8), name: '车1进1' },
  ],
  weights: [40, 35, 25],
});

// 中炮 + 屏风马(左) + 马二进三 + 双马 + 车一进一
addSymmetric('7,7->7,4|0,1->2,2|9,7->7,6|0,7->2,6|9,8->8,8', {
  moves: [
    { from: pos(0, 0), to: pos(1, 0), name: '车9进1' },
    { from: pos(3, 2), to: pos(4, 2), name: '卒3进1' },
  ],
  weights: [55, 45],
});

// ============================================================
// AI AS RED: 3rd move (after 4 half-moves)
// ============================================================

// 中炮 + 屏风马(左) + 马二进三 + 双马
addSymmetric('7,7->7,4|0,1->2,2|9,7->7,6|0,7->2,6', {
  moves: [
    { from: pos(9, 8), to: pos(8, 8), name: '车一进一' },
    { from: pos(9, 8), to: pos(9, 7), name: '车一平二' },
    { from: pos(9, 0), to: pos(8, 0), name: '车九进一' },
  ],
  weights: [40, 35, 25],
});

// 中炮 + 屏风马(左) + 马八进七 + 双马
addSymmetric('7,7->7,4|0,1->2,2|9,1->7,2|0,7->2,6', {
  moves: [
    { from: pos(9, 0), to: pos(8, 0), name: '车九进一' },
    { from: pos(9, 7), to: pos(7, 6), name: '马二进三' },
  ],
  weights: [55, 45],
});

// ============================================================
// Lookup function
// ============================================================

export function lookupOpeningBook(
  moveHistory: { from: Position; to: Position }[],
  aiColor: PieceColor
): OpeningMove | null {
  // Only use opening book for first 8 moves (4 pairs)
  if (moveHistory.length > 8) return null;

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
