// Chinese Chess Opening Book
// Contains classic openings for both red and black sides, 5-10 moves deep
// Based on standard opening theory from professional play
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

function addEntry(key: string, entry: SequenceBookEntry) {
  sequenceBook.set(key, entry);
}

function mirrorCol(c: number): number { return 8 - c; }

function mirrorMoveKey(k: string): string {
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

function addSymmetric(key: string, entry: SequenceBookEntry) {
  addEntry(key, entry);
  const mKey = key.split('|').map(mirrorMoveKey).join('|');
  if (mKey !== key) {
    addEntry(mKey, mirrorEntry(entry));
  }
}

// ============================================================
// COORDINATE REFERENCE (Red's perspective, row 0=top, row 9=bottom)
// ============================================================
// Initial positions:
// Row 0: 黑車(0,0) 黑馬(0,1) 黑象(0,2) 黑士(0,3) 黑將(0,4) 黑士(0,5) 黑象(0,6) 黑馬(0,7) 黑車(0,8)
// Row 2: 黑砲(2,1) 黑砲(2,7)
// Row 3: 黑卒(3,0) (3,2) (3,4) (3,6) (3,8)
// Row 6: 红兵(6,0) (6,2) (6,4) (6,6) (6,8)
// Row 7: 红炮(7,1) 红炮(7,7)
// Row 9: 红車(9,0) 红馬(9,1) 红相(9,2) 红士(9,3) 红帥(9,4) 红士(9,5) 红相(9,6) 红馬(9,7) 红車(9,8)
//
// Chinese notation → column mapping:
// Red: 九=0, 八=1, 七=2, 六=3, 五=4, 四=5, 三=6, 二=7, 一=8
// Black: 1=8, 2=7, 3=6, 4=5, 5=4, 6=3, 7=2, 8=1, 9=0

// ============================================================
// AI AS RED: First move (empty history)
// ============================================================
addEntry('', {
  moves: [
    { from: pos(7, 7), to: pos(7, 4), name: '中炮 (炮二平五)' },
    { from: pos(7, 1), to: pos(7, 4), name: '中炮 (炮八平五)' },
    { from: pos(9, 6), to: pos(7, 4), name: '飞相 (相三进五)' },
    { from: pos(6, 2), to: pos(5, 2), name: '仙人指路 (兵七进一)' },
    { from: pos(9, 7), to: pos(7, 6), name: '起马 (马二进三)' },
    { from: pos(7, 7), to: pos(7, 3), name: '过宫炮 (炮二平六)' },
  ],
  weights: [30, 20, 15, 15, 12, 8],
});

// ============================================================
// LEVEL 1: AI AS BLACK responds to Red's 1st move
// ============================================================

// --- Red: 中炮 炮二平五 (7,7)->(7,4) ---
addSymmetric('7,7->7,4', {
  moves: [
    { from: pos(0, 1), to: pos(2, 2), name: '屏风马 (马8进7)' },
    { from: pos(0, 7), to: pos(2, 6), name: '屏风马 (马2进3)' },
    { from: pos(0, 7), to: pos(2, 6), name: '反宫马 (马2进3)' },
    { from: pos(2, 1), to: pos(2, 4), name: '顺炮 (砲8平5)' },
    { from: pos(2, 7), to: pos(2, 4), name: '列炮 (砲2平5)' },
  ],
  weights: [30, 25, 15, 15, 15],
});

// --- Red: 飞相 相三进五 (9,6)->(7,4) ---
addSymmetric('9,6->7,4', {
  moves: [
    { from: pos(2, 1), to: pos(2, 4), name: '左中炮 (砲8平5)' },
    { from: pos(2, 1), to: pos(2, 5), name: '左过宫炮 (砲8平4)' },
    { from: pos(2, 1), to: pos(2, 3), name: '左士角炮 (砲8平6)' },
    { from: pos(2, 7), to: pos(2, 5), name: '右士角炮 (砲2平4)' },
    { from: pos(0, 1), to: pos(2, 2), name: '起马 (马8进7)' },
  ],
  weights: [25, 20, 20, 20, 15],
});

// --- Red: 仙人指路 兵七进一 (6,2)->(5,2) ---
addSymmetric('6,2->5,2', {
  moves: [
    { from: pos(2, 7), to: pos(2, 6), name: '卒底炮 (砲2平3)' },
    { from: pos(3, 2), to: pos(4, 2), name: '对卒 (卒7进1)' },
    { from: pos(0, 1), to: pos(2, 2), name: '起马 (马8进7)' },
    { from: pos(0, 6), to: pos(2, 4), name: '飞象 (象3进5)' },
  ],
  weights: [30, 30, 20, 20],
});

// --- Red: 起马 马二进三 (9,7)->(7,6) ---
addSymmetric('9,7->7,6', {
  moves: [
    { from: pos(0, 1), to: pos(2, 2), name: '对马 (马8进7)' },
    { from: pos(2, 1), to: pos(2, 4), name: '中炮 (砲8平5)' },
    { from: pos(3, 2), to: pos(4, 2), name: '进卒 (卒7进1)' },
  ],
  weights: [40, 35, 25],
});

// --- Red: 过宫炮 炮二平六 (7,7)->(7,3) ---
addSymmetric('7,7->7,3', {
  moves: [
    { from: pos(0, 1), to: pos(2, 2), name: '进马 (马8进7)' },
    { from: pos(0, 7), to: pos(2, 6), name: '进马 (马2进3)' },
    { from: pos(2, 1), to: pos(2, 4), name: '中炮 (砲8平5)' },
  ],
  weights: [35, 35, 30],
});

// --- Red: 士角炮 炮二平四 (7,7)->(7,5) ---
addSymmetric('7,7->7,5', {
  moves: [
    { from: pos(0, 1), to: pos(2, 2), name: '进马 (马8进7)' },
    { from: pos(0, 7), to: pos(2, 6), name: '进马 (马2进3)' },
    { from: pos(2, 1), to: pos(2, 4), name: '中炮 (砲8平5)' },
  ],
  weights: [35, 35, 30],
});

// --- Red: 炮二进二 (non-standard) (7,7)->(5,7) ---
addSymmetric('7,7->5,7', {
  moves: [
    { from: pos(0, 1), to: pos(2, 2), name: '起马 (马8进7)' },
    { from: pos(0, 7), to: pos(2, 6), name: '起马 (马2进3)' },
    { from: pos(2, 1), to: pos(2, 4), name: '中炮 (砲八平五)' },
  ],
  weights: [35, 35, 30],
});

// --- Red: 炮二进一 (7,7)->(6,7) ---
addSymmetric('7,7->6,7', {
  moves: [
    { from: pos(0, 1), to: pos(2, 2), name: '起马 (马8进7)' },
    { from: pos(0, 7), to: pos(2, 6), name: '起马 (马2进3)' },
    { from: pos(2, 1), to: pos(2, 4), name: '中炮 (砲八平五)' },
  ],
  weights: [35, 35, 30],
});

// --- Red: 兵一进一 (6,8)->(5,8) ---
addSymmetric('6,8->5,8', {
  moves: [
    { from: pos(2, 1), to: pos(2, 4), name: '中炮 (砲八平五)' },
    { from: pos(0, 1), to: pos(2, 2), name: '起马 (马8进7)' },
    { from: pos(3, 2), to: pos(4, 2), name: '进卒 (卒七进一)' },
  ],
  weights: [40, 35, 25],
});

// --- Red: 兵五进一 (6,4)->(5,4) ---
addSymmetric('6,4->5,4', {
  moves: [
    { from: pos(2, 1), to: pos(2, 4), name: '中炮 (砲八平五)' },
    { from: pos(0, 1), to: pos(2, 2), name: '起马 (马8进7)' },
    { from: pos(0, 7), to: pos(2, 6), name: '起马 (马2进3)' },
  ],
  weights: [40, 30, 30],
});

// --- Red: 仕四进五 (9,5)->(8,4) ---
addSymmetric('9,5->8,4', {
  moves: [
    { from: pos(2, 1), to: pos(2, 4), name: '中炮 (砲八平五)' },
    { from: pos(0, 1), to: pos(2, 2), name: '起马 (马8进7)' },
    { from: pos(0, 7), to: pos(2, 6), name: '起马 (马2进3)' },
  ],
  weights: [40, 30, 30],
});

// --- Red: 車一进一 (9,8)->(8,8) ---
addSymmetric('9,8->8,8', {
  moves: [
    { from: pos(2, 1), to: pos(2, 4), name: '中炮 (砲八平五)' },
    { from: pos(0, 1), to: pos(2, 2), name: '起马 (马8进7)' },
    { from: pos(0, 7), to: pos(2, 6), name: '起马 (马2进3)' },
  ],
  weights: [35, 35, 30],
});

// --- Red: 炮二平七 (7,7)->(7,2) ---
addSymmetric('7,7->7,2', {
  moves: [
    { from: pos(0, 1), to: pos(2, 2), name: '起马 (马8进7)' },
    { from: pos(2, 1), to: pos(2, 4), name: '中炮 (砲八平五)' },
    { from: pos(0, 7), to: pos(2, 6), name: '起马 (马2进3)' },
  ],
  weights: [35, 35, 30],
});

// --- Red: 炮二平一 (7,7)->(7,8) ---
addSymmetric('7,7->7,8', {
  moves: [
    { from: pos(0, 1), to: pos(2, 2), name: '起马 (马8进7)' },
    { from: pos(2, 1), to: pos(2, 4), name: '中炮 (砲八平五)' },
    { from: pos(0, 7), to: pos(2, 6), name: '起马 (马2进3)' },
  ],
  weights: [35, 35, 30],
});

// --- Red: 相七进九 (9,2)->(7,0) ---
addSymmetric('9,2->7,0', {
  moves: [
    { from: pos(2, 1), to: pos(2, 4), name: '中炮 (砲八平五)' },
    { from: pos(0, 1), to: pos(2, 2), name: '起马 (马8进7)' },
    { from: pos(0, 7), to: pos(2, 6), name: '起马 (马2进3)' },
  ],
  weights: [40, 30, 30],
});

// --- Red: 马二进一 (edge horse) (9,7)->(7,8) ---
addSymmetric('9,7->7,8', {
  moves: [
    { from: pos(2, 1), to: pos(2, 4), name: '中炮 (砲八平五)' },
    { from: pos(0, 1), to: pos(2, 2), name: '起马 (马8进7)' },
    { from: pos(0, 7), to: pos(2, 6), name: '起马 (马2进3)' },
  ],
  weights: [40, 30, 30],
});

// ============================================================
// LEVEL 2: AI AS RED responds after Red1 + Black1 (2 half-moves)
// ============================================================

// --- 中炮 + 屏风马左 ---
addSymmetric('7,7->7,4|0,1->2,2', {
  moves: [
    { from: pos(9, 7), to: pos(7, 6), name: '马二进三' },
    { from: pos(9, 1), to: pos(7, 2), name: '马八进七' },
    { from: pos(9, 8), to: pos(9, 7), name: '车一平二' },
  ],
  weights: [40, 30, 30],
});

// --- 中炮 + 屏风马右 ---
addSymmetric('7,7->7,4|0,7->2,6', {
  moves: [
    { from: pos(9, 1), to: pos(7, 2), name: '马八进七' },
    { from: pos(9, 7), to: pos(7, 6), name: '马二进三' },
    { from: pos(9, 0), to: pos(9, 1), name: '车九平八' },
  ],
  weights: [40, 30, 30],
});

// --- 中炮 + 顺炮 ---
addSymmetric('7,7->7,4|2,1->2,4', {
  moves: [
    { from: pos(9, 7), to: pos(7, 6), name: '马二进三' },
    { from: pos(9, 1), to: pos(7, 2), name: '马八进七' },
  ],
  weights: [55, 45],
});

// --- 中炮 + 列炮 ---
addSymmetric('7,7->7,4|2,7->2,4', {
  moves: [
    { from: pos(9, 7), to: pos(7, 6), name: '马二进三' },
    { from: pos(9, 1), to: pos(7, 2), name: '马八进七' },
  ],
  weights: [55, 45],
});

// --- 中炮 + 反宫马 (马2进3 then 砲8平6) ---
addSymmetric('7,7->7,4|0,7->2,6', {
  moves: [
    { from: pos(9, 7), to: pos(7, 6), name: '马二进三' },
    { from: pos(9, 1), to: pos(7, 2), name: '马八进七' },
  ],
  weights: [55, 45],
});

// --- 飞相 + 左中炮 ---
addSymmetric('9,6->7,4|2,1->2,4', {
  moves: [
    { from: pos(9, 7), to: pos(7, 6), name: '马二进三' },
    { from: pos(6, 6), to: pos(5, 6), name: '兵三进一' },
    { from: pos(9, 1), to: pos(7, 2), name: '马八进七' },
  ],
  weights: [40, 30, 30],
});

// --- 飞相 + 左过宫炮 ---
addSymmetric('9,6->7,4|2,1->2,5', {
  moves: [
    { from: pos(9, 7), to: pos(7, 6), name: '马二进三' },
    { from: pos(6, 6), to: pos(5, 6), name: '兵三进一' },
    { from: pos(6, 2), to: pos(5, 2), name: '兵七进一' },
  ],
  weights: [40, 30, 30],
});

// --- 飞相 + 左士角炮 ---
addSymmetric('9,6->7,4|2,1->2,3', {
  moves: [
    { from: pos(9, 7), to: pos(7, 6), name: '马二进三' },
    { from: pos(6, 6), to: pos(5, 6), name: '兵三进一' },
    { from: pos(6, 2), to: pos(5, 2), name: '兵七进一' },
  ],
  weights: [40, 30, 30],
});

// --- 飞相 + 右士角炮 ---
addSymmetric('9,6->7,4|2,7->2,5', {
  moves: [
    { from: pos(9, 0), to: pos(8, 0), name: '车九进一' },
    { from: pos(6, 2), to: pos(5, 2), name: '兵七进一' },
    { from: pos(6, 6), to: pos(5, 6), name: '兵三进一' },
  ],
  weights: [35, 35, 30],
});

// --- 飞相 + 起马 ---
addSymmetric('9,6->7,4|0,1->2,2', {
  moves: [
    { from: pos(9, 7), to: pos(7, 6), name: '马二进三' },
    { from: pos(9, 1), to: pos(7, 2), name: '马八进七' },
    { from: pos(7, 7), to: pos(7, 4), name: '炮二平五' },
  ],
  weights: [35, 35, 30],
});

// --- 仙人指路 + 卒底炮 ---
addSymmetric('6,2->5,2|2,7->2,6', {
  moves: [
    { from: pos(7, 7), to: pos(7, 4), name: '炮二平五 (右中炮)' },
    { from: pos(7, 1), to: pos(7, 4), name: '炮八平五 (左中炮)' },
    { from: pos(9, 6), to: pos(7, 4), name: '相三进五 (飞相)' },
  ],
  weights: [40, 30, 30],
});

// --- 仙人指路 + 对卒 ---
addSymmetric('6,2->5,2|3,2->4,2', {
  moves: [
    { from: pos(7, 7), to: pos(7, 6), name: '炮二平三 (兵底炮)' },
    { from: pos(9, 1), to: pos(7, 2), name: '马八进七 (起马)' },
    { from: pos(7, 7), to: pos(7, 4), name: '炮二平五 (中炮)' },
  ],
  weights: [35, 35, 30],
});

// --- 仙人指路 + 起马 ---
addSymmetric('6,2->5,2|0,1->2,2', {
  moves: [
    { from: pos(6, 6), to: pos(5, 6), name: '兵三进一 (两头蛇)' },
    { from: pos(9, 7), to: pos(7, 6), name: '马二进三' },
    { from: pos(7, 7), to: pos(7, 4), name: '炮二平五' },
  ],
  weights: [40, 30, 30],
});

// --- 起马 + 对马 ---
addSymmetric('9,7->7,6|0,1->2,2', {
  moves: [
    { from: pos(6, 2), to: pos(5, 2), name: '兵七进一' },
    { from: pos(7, 7), to: pos(7, 4), name: '炮二平五' },
    { from: pos(9, 8), to: pos(9, 7), name: '车一平二' },
  ],
  weights: [35, 35, 30],
});

// --- 过宫炮 + 进马 ---
addSymmetric('7,7->7,3|0,1->2,2', {
  moves: [
    { from: pos(9, 7), to: pos(7, 6), name: '马二进三' },
    { from: pos(9, 1), to: pos(7, 2), name: '马八进七' },
  ],
  weights: [55, 45],
});

// ============================================================
// LEVEL 3: AI AS BLACK responds after R1+B1+R2 (3 half-moves)
// ============================================================

// --- 中炮 + 屏风马左 + 马二进三 ---
addSymmetric('7,7->7,4|0,1->2,2|9,7->7,6', {
  moves: [
    { from: pos(0, 0), to: pos(0, 1), name: '车9平8 (出车)' },
    { from: pos(0, 7), to: pos(2, 6), name: '马2进3 (双马)' },
    { from: pos(3, 2), to: pos(4, 2), name: '卒7进1' },
  ],
  weights: [40, 35, 25],
});

// --- 中炮 + 屏风马左 + 车一平二 ---
addSymmetric('7,7->7,4|0,1->2,2|9,8->9,7', {
  moves: [
    { from: pos(0, 7), to: pos(2, 6), name: '马2进3 (双马)' },
    { from: pos(0, 0), to: pos(0, 1), name: '车9平8' },
    { from: pos(3, 2), to: pos(4, 2), name: '卒7进1' },
  ],
  weights: [40, 35, 25],
});

// --- 中炮 + 屏风马左 + 马八进七 ---
addSymmetric('7,7->7,4|0,1->2,2|9,1->7,2', {
  moves: [
    { from: pos(0, 7), to: pos(2, 6), name: '马2进3 (双马)' },
    { from: pos(0, 0), to: pos(0, 1), name: '车9平8' },
    { from: pos(3, 6), to: pos(4, 6), name: '卒3进1' },
  ],
  weights: [40, 35, 25],
});

// --- 中炮 + 顺炮 + 马二进三 ---
addSymmetric('7,7->7,4|2,1->2,4|9,7->7,6', {
  moves: [
    { from: pos(0, 1), to: pos(2, 2), name: '马8进7' },
    { from: pos(0, 7), to: pos(2, 6), name: '马2进3' },
  ],
  weights: [55, 45],
});

// --- 中炮 + 列炮 + 马二进三 ---
addSymmetric('7,7->7,4|2,7->2,4|9,7->7,6', {
  moves: [
    { from: pos(0, 1), to: pos(2, 2), name: '马8进7' },
    { from: pos(0, 0), to: pos(0, 1), name: '车9平8' },
  ],
  weights: [55, 45],
});

// --- 飞相 + 左中炮 + 马二进三 ---
addSymmetric('9,6->7,4|2,1->2,4|9,7->7,6', {
  moves: [
    { from: pos(0, 1), to: pos(2, 2), name: '马8进7' },
    { from: pos(3, 6), to: pos(4, 6), name: '卒3进1' },
  ],
  weights: [55, 45],
});

// --- 飞相 + 左过宫炮 + 马二进三 ---
addSymmetric('9,6->7,4|2,1->2,5|9,7->7,6', {
  moves: [
    { from: pos(0, 1), to: pos(2, 2), name: '马8进7' },
    { from: pos(3, 2), to: pos(4, 2), name: '卒7进1' },
  ],
  weights: [55, 45],
});

// --- 飞相 + 左士角炮 + 马二进三 ---
addSymmetric('9,6->7,4|2,1->2,3|9,7->7,6', {
  moves: [
    { from: pos(0, 1), to: pos(2, 2), name: '马8进7' },
    { from: pos(3, 2), to: pos(4, 2), name: '卒7进1' },
  ],
  weights: [55, 45],
});

// --- 仙人指路 + 卒底炮 + 右中炮 ---
addSymmetric('6,2->5,2|2,7->2,6|7,7->7,4', {
  moves: [
    { from: pos(0, 6), to: pos(2, 4), name: '象3进5 (飞象)' },
    { from: pos(0, 1), to: pos(2, 2), name: '马8进7' },
  ],
  weights: [55, 45],
});

// --- 仙人指路 + 对卒 + 兵底炮 ---
addSymmetric('6,2->5,2|3,2->4,2|7,7->7,6', {
  moves: [
    { from: pos(0, 1), to: pos(2, 2), name: '马8进7' },
    { from: pos(0, 7), to: pos(2, 6), name: '马2进3' },
  ],
  weights: [55, 45],
});

// --- 仙人指路 + 对卒 + 起马 ---
addSymmetric('6,2->5,2|3,2->4,2|9,1->7,2', {
  moves: [
    { from: pos(0, 1), to: pos(2, 2), name: '马8进7' },
    { from: pos(2, 1), to: pos(2, 4), name: '砲8平5 (中炮)' },
  ],
  weights: [55, 45],
});

// --- 起马 + 对马 + 兵七进一 ---
addSymmetric('9,7->7,6|0,1->2,2|6,2->5,2', {
  moves: [
    { from: pos(0, 0), to: pos(0, 1), name: '车9平8' },
    { from: pos(3, 2), to: pos(4, 2), name: '卒7进1' },
    { from: pos(2, 1), to: pos(2, 4), name: '砲8平5' },
  ],
  weights: [35, 35, 30],
});

// --- 过宫炮 + 进马 + 马二进三 ---
addSymmetric('7,7->7,3|0,1->2,2|9,7->7,6', {
  moves: [
    { from: pos(0, 0), to: pos(0, 1), name: '车9平8' },
    { from: pos(2, 1), to: pos(2, 0), name: '砲8平9 (三步虎)' },
    { from: pos(0, 7), to: pos(2, 6), name: '马2进3' },
  ],
  weights: [35, 35, 30],
});

// ============================================================
// LEVEL 4: AI AS RED responds after R1+B1+R2+B2 (4 half-moves)
// ============================================================

// --- 中炮 + 屏风马左 + 马二进三 + 车9平8 ---
addSymmetric('7,7->7,4|0,1->2,2|9,7->7,6|0,0->0,1', {
  moves: [
    { from: pos(9, 8), to: pos(9, 7), name: '车一平二' },
    { from: pos(6, 2), to: pos(5, 2), name: '兵七进一' },
    { from: pos(9, 1), to: pos(7, 2), name: '马八进七' },
  ],
  weights: [40, 30, 30],
});

// --- 中炮 + 屏风马左 + 马二进三 + 双马(马2进3) ---
addSymmetric('7,7->7,4|0,1->2,2|9,7->7,6|0,7->2,6', {
  moves: [
    { from: pos(9, 8), to: pos(9, 7), name: '车一平二' },
    { from: pos(9, 8), to: pos(8, 8), name: '车一进一' },
    { from: pos(6, 2), to: pos(5, 2), name: '兵七进一' },
  ],
  weights: [40, 30, 30],
});

// --- 中炮 + 屏风马左 + 车一平二 + 马2进3 ---
addSymmetric('7,7->7,4|0,1->2,2|9,8->9,7|0,7->2,6', {
  moves: [
    { from: pos(6, 2), to: pos(5, 2), name: '兵七进一' },
    { from: pos(6, 6), to: pos(5, 6), name: '兵三进一' },
    { from: pos(9, 1), to: pos(7, 2), name: '马八进七' },
  ],
  weights: [35, 35, 30],
});

// --- 中炮 + 屏风马左 + 车一平二 + 车9平8 ---
addSymmetric('7,7->7,4|0,1->2,2|9,8->9,7|0,0->0,1', {
  moves: [
    { from: pos(9, 1), to: pos(7, 2), name: '马八进七' },
    { from: pos(6, 2), to: pos(5, 2), name: '兵七进一' },
    { from: pos(6, 6), to: pos(5, 6), name: '兵三进一' },
  ],
  weights: [40, 30, 30],
});

// --- 中炮 + 顺炮 + 马二进三 + 马8进7 ---
addSymmetric('7,7->7,4|2,1->2,4|9,7->7,6|0,1->2,2', {
  moves: [
    { from: pos(9, 8), to: pos(9, 7), name: '车一平二' },
    { from: pos(9, 0), to: pos(9, 1), name: '车九平八' },
  ],
  weights: [55, 45],
});

// --- 中炮 + 列炮 + 马二进三 + 马8进7 ---
addSymmetric('7,7->7,4|2,7->2,4|9,7->7,6|0,1->2,2', {
  moves: [
    { from: pos(9, 8), to: pos(9, 7), name: '车一平二' },
    { from: pos(6, 2), to: pos(5, 2), name: '兵七进一' },
  ],
  weights: [55, 45],
});

// --- 飞相 + 左中炮 + 马二进三 + 马8进7 ---
addSymmetric('9,6->7,4|2,1->2,4|9,7->7,6|0,1->2,2', {
  moves: [
    { from: pos(9, 8), to: pos(9, 7), name: '车一平二' },
    { from: pos(6, 6), to: pos(5, 6), name: '兵三进一' },
  ],
  weights: [55, 45],
});

// --- 飞相 + 左过宫炮 + 马二进三 + 马8进7 ---
addSymmetric('9,6->7,4|2,1->2,5|9,7->7,6|0,1->2,2', {
  moves: [
    { from: pos(9, 8), to: pos(9, 7), name: '车一平二' },
    { from: pos(6, 2), to: pos(5, 2), name: '兵七进一' },
  ],
  weights: [55, 45],
});

// --- 飞相 + 左士角炮 + 马二进三 + 马8进7 ---
addSymmetric('9,6->7,4|2,1->2,3|9,7->7,6|0,1->2,2', {
  moves: [
    { from: pos(9, 8), to: pos(9, 7), name: '车一平二' },
    { from: pos(6, 6), to: pos(5, 6), name: '兵三进一' },
  ],
  weights: [55, 45],
});

// --- 仙人指路 + 卒底炮 + 右中炮 + 象3进5 ---
addSymmetric('6,2->5,2|2,7->2,6|7,7->7,4|0,6->2,4', {
  moves: [
    { from: pos(9, 7), to: pos(7, 6), name: '马二进三' },
    { from: pos(9, 1), to: pos(7, 2), name: '马八进七' },
  ],
  weights: [55, 45],
});

// --- 过宫炮 + 进马 + 马二进三 + 车9平8 ---
addSymmetric('7,7->7,3|0,1->2,2|9,7->7,6|0,0->0,1', {
  moves: [
    { from: pos(9, 8), to: pos(9, 7), name: '车一平二' },
    { from: pos(6, 2), to: pos(5, 2), name: '兵七进一' },
  ],
  weights: [55, 45],
});

// ============================================================
// LEVEL 5: AI AS BLACK responds after 5 half-moves (R1+B1+R2+B2+R3)
// ============================================================

// --- 中炮 + 屏风马左 + 马二进三 + 车9平8 + 车一平二 ---
// 1A main line: 中炮过河车对屏风马
addSymmetric('7,7->7,4|0,1->2,2|9,7->7,6|0,0->0,1|9,8->9,7', {
  moves: [
    { from: pos(0, 7), to: pos(2, 6), name: '马2进3 (双马)' },
    { from: pos(3, 2), to: pos(4, 2), name: '卒7进1' },
    { from: pos(0, 8), to: pos(0, 7), name: '车1平2' },
  ],
  weights: [40, 35, 25],
});

// --- 中炮 + 屏风马左 + 马二进三 + 双马 + 车一平二 ---
addSymmetric('7,7->7,4|0,1->2,2|9,7->7,6|0,7->2,6|9,8->9,7', {
  moves: [
    { from: pos(0, 0), to: pos(0, 1), name: '车9平8' },
    { from: pos(3, 2), to: pos(4, 2), name: '卒7进1' },
  ],
  weights: [55, 45],
});

// --- 中炮 + 屏风马左 + 马二进三 + 双马 + 兵七进一 ---
addSymmetric('7,7->7,4|0,1->2,2|9,7->7,6|0,7->2,6|6,2->5,2', {
  moves: [
    { from: pos(0, 0), to: pos(0, 1), name: '车9平8' },
    { from: pos(3, 2), to: pos(4, 2), name: '卒7进1' },
    { from: pos(0, 6), to: pos(2, 4), name: '象3进5' },
  ],
  weights: [40, 35, 25],
});

// --- 中炮 + 屏风马左 + 车一平二 + 马2进3 + 兵七进一 ---
addSymmetric('7,7->7,4|0,1->2,2|9,8->9,7|0,7->2,6|6,2->5,2', {
  moves: [
    { from: pos(3, 2), to: pos(4, 2), name: '卒7进1' },
    { from: pos(0, 0), to: pos(0, 1), name: '车9平8' },
    { from: pos(0, 6), to: pos(2, 4), name: '象3进5' },
  ],
  weights: [40, 35, 25],
});

// --- 中炮 + 屏风马左 + 车一平二 + 马2进3 + 兵三进一 ---
// 1F: 中炮进三兵对屏风马
addSymmetric('7,7->7,4|0,1->2,2|9,8->9,7|0,7->2,6|6,6->5,6', {
  moves: [
    { from: pos(3, 6), to: pos(4, 6), name: '卒3进1' },
    { from: pos(0, 0), to: pos(0, 1), name: '车9平8' },
  ],
  weights: [55, 45],
});

// --- 中炮 + 顺炮 + 马二进三 + 马8进7 + 车一平二 ---
addSymmetric('7,7->7,4|2,1->2,4|9,7->7,6|0,1->2,2|9,8->9,7', {
  moves: [
    { from: pos(0, 0), to: pos(1, 0), name: '车9进1 (横车)' },
    { from: pos(3, 2), to: pos(4, 2), name: '卒7进1' },
    { from: pos(0, 7), to: pos(2, 6), name: '马2进3' },
  ],
  weights: [35, 35, 30],
});

// --- 飞相 + 左中炮 + 马二进三 + 马8进7 + 车一平二 ---
addSymmetric('9,6->7,4|2,1->2,4|9,7->7,6|0,1->2,2|9,8->9,7', {
  moves: [
    { from: pos(0, 0), to: pos(0, 1), name: '车9平8' },
    { from: pos(3, 2), to: pos(4, 2), name: '卒7进1' },
  ],
  weights: [55, 45],
});

// --- 飞相 + 左过宫炮 + 马二进三 + 马8进7 + 车一平二 ---
addSymmetric('9,6->7,4|2,1->2,5|9,7->7,6|0,1->2,2|9,8->9,7', {
  moves: [
    { from: pos(0, 0), to: pos(0, 1), name: '车9平8' },
    { from: pos(3, 2), to: pos(4, 2), name: '卒7进1' },
  ],
  weights: [55, 45],
});

// --- 飞相 + 左士角炮 + 马二进三 + 马8进7 + 车一平二 ---
addSymmetric('9,6->7,4|2,1->2,3|9,7->7,6|0,1->2,2|9,8->9,7', {
  moves: [
    { from: pos(0, 0), to: pos(0, 1), name: '车9平8' },
    { from: pos(3, 6), to: pos(4, 6), name: '卒3进1' },
  ],
  weights: [55, 45],
});

// --- 仙人指路 + 卒底炮 + 右中炮 + 象3进5 + 马二进三 ---
addSymmetric('6,2->5,2|2,7->2,6|7,7->7,4|0,6->2,4|9,7->7,6', {
  moves: [
    { from: pos(0, 1), to: pos(2, 2), name: '马8进7' },
    { from: pos(0, 7), to: pos(2, 6), name: '马2进3' },
  ],
  weights: [55, 45],
});

// ============================================================
// LEVEL 6: AI AS RED responds after 6 half-moves
// ============================================================

// --- 中炮 + 屏风马左 + 马二进三 + 车9平8 + 车一平二 + 马2进3 ---
// Main line continues with 兵七进一
addSymmetric('7,7->7,4|0,1->2,2|9,7->7,6|0,0->0,1|9,8->9,7|0,7->2,6', {
  moves: [
    { from: pos(6, 2), to: pos(5, 2), name: '兵七进一' },
    { from: pos(6, 6), to: pos(5, 6), name: '兵三进一' },
    { from: pos(9, 1), to: pos(7, 2), name: '马八进七' },
  ],
  weights: [40, 30, 30],
});

// --- 中炮 + 屏风马左 + 马二进三 + 双马 + 车一平二 + 车9平8 ---
addSymmetric('7,7->7,4|0,1->2,2|9,7->7,6|0,7->2,6|9,8->9,7|0,0->0,1', {
  moves: [
    { from: pos(6, 2), to: pos(5, 2), name: '兵七进一' },
    { from: pos(9, 1), to: pos(7, 2), name: '马八进七' },
  ],
  weights: [55, 45],
});

// --- 中炮 + 屏风马左 + 车一平二 + 马2进3 + 兵三进一 + 卒3进1 ---
addSymmetric('7,7->7,4|0,1->2,2|9,8->9,7|0,7->2,6|6,6->5,6|3,6->4,6', {
  moves: [
    { from: pos(9, 1), to: pos(7, 2), name: '马八进七' },
    { from: pos(7, 1), to: pos(7, 2), name: '炮八平七' },
  ],
  weights: [55, 45],
});

// --- 飞相 + 左中炮 + 马二进三 + 马8进7 + 车一平二 + 车9平8 ---
addSymmetric('9,6->7,4|2,1->2,4|9,7->7,6|0,1->2,2|9,8->9,7|0,0->0,1', {
  moves: [
    { from: pos(6, 6), to: pos(5, 6), name: '兵三进一' },
    { from: pos(6, 2), to: pos(5, 2), name: '兵七进一' },
  ],
  weights: [55, 45],
});

// --- 飞相 + 左过宫炮 + 马二进三 + 马8进7 + 车一平二 + 车9平8 ---
addSymmetric('9,6->7,4|2,1->2,5|9,7->7,6|0,1->2,2|9,8->9,7|0,0->0,1', {
  moves: [
    { from: pos(7, 7), to: pos(3, 7), name: '炮二进四 (封车)' },
    { from: pos(6, 2), to: pos(5, 2), name: '兵七进一' },
  ],
  weights: [55, 45],
});

// --- 飞相 + 左士角炮 + 马二进三 + 马8进7 + 车一平二 + 车9平8 ---
addSymmetric('9,6->7,4|2,1->2,3|9,7->7,6|0,1->2,2|9,8->9,7|0,0->0,1', {
  moves: [
    { from: pos(6, 6), to: pos(5, 6), name: '兵三进一' },
    { from: pos(9, 1), to: pos(7, 2), name: '马八进七' },
  ],
  weights: [55, 45],
});

// ============================================================
// LEVEL 7: AI AS BLACK responds after 7 half-moves
// ============================================================

// --- 中炮 + 屏风马左 + 马二进三 + 车9平8 + 车一平二 + 马2进3 + 兵七进一 ---
// 1A main line move 4
addSymmetric('7,7->7,4|0,1->2,2|9,7->7,6|0,0->0,1|9,8->9,7|0,7->2,6|6,2->5,2', {
  moves: [
    { from: pos(3, 2), to: pos(4, 2), name: '卒7进1' },
    { from: pos(0, 6), to: pos(2, 4), name: '象3进5' },
  ],
  weights: [55, 45],
});

// --- 中炮 + 屏风马左 + 马二进三 + 车9平8 + 车一平二 + 马2进3 + 兵三进一 ---
// 1F line
addSymmetric('7,7->7,4|0,1->2,2|9,7->7,6|0,0->0,1|9,8->9,7|0,7->2,6|6,6->5,6', {
  moves: [
    { from: pos(3, 6), to: pos(4, 6), name: '卒3进1' },
    { from: pos(0, 6), to: pos(2, 4), name: '象3进5' },
  ],
  weights: [55, 45],
});

// --- 中炮 + 屏风马左 + 马二进三 + 双马 + 车一平二 + 车9平8 + 兵七进一 ---
addSymmetric('7,7->7,4|0,1->2,2|9,7->7,6|0,7->2,6|9,8->9,7|0,0->0,1|6,2->5,2', {
  moves: [
    { from: pos(3, 2), to: pos(4, 2), name: '卒7进1' },
    { from: pos(0, 6), to: pos(2, 4), name: '象3进5' },
    { from: pos(2, 1), to: pos(2, 0), name: '砲8平9' },
  ],
  weights: [40, 35, 25],
});

// --- 飞相 + 左中炮 + 马二进三 + 马8进7 + 车一平二 + 车9平8 + 兵三进一 ---
addSymmetric('9,6->7,4|2,1->2,4|9,7->7,6|0,1->2,2|9,8->9,7|0,0->0,1|6,6->5,6', {
  moves: [
    { from: pos(2, 7), to: pos(2, 5), name: '砲2平4 (过宫炮)' },
    { from: pos(0, 7), to: pos(2, 6), name: '马2进3' },
  ],
  weights: [55, 45],
});

// --- 飞相 + 左士角炮 + 马二进三 + 马8进7 + 车一平二 + 车9平8 + 兵三进一 ---
addSymmetric('9,6->7,4|2,1->2,3|9,7->7,6|0,1->2,2|9,8->9,7|0,0->0,1|6,6->5,6', {
  moves: [
    { from: pos(3, 6), to: pos(4, 6), name: '卒3进1' },
    { from: pos(0, 7), to: pos(2, 6), name: '马2进3' },
  ],
  weights: [55, 45],
});

// ============================================================
// LEVEL 8-10: Deep lines for the most common variations
// ============================================================

// --- 1A: 中炮过河车 move 5 (R) ---
// 中炮+屏风马左+马二进三+车9平8+车一平二+马2进3+兵七进一+卒7进1
addSymmetric('7,7->7,4|0,1->2,2|9,7->7,6|0,0->0,1|9,8->9,7|0,7->2,6|6,2->5,2|3,2->4,2', {
  moves: [
    { from: pos(9, 7), to: pos(3, 7), name: '车二进六 (过河车)' },
    { from: pos(7, 1), to: pos(7, 2), name: '炮八平七 (五七炮)' },
    { from: pos(9, 1), to: pos(7, 2), name: '马八进七 (七路马)' },
  ],
  weights: [40, 30, 30],
});

// --- 1A: move 5 (B) after 车二进六 ---
addSymmetric('7,7->7,4|0,1->2,2|9,7->7,6|0,0->0,1|9,8->9,7|0,7->2,6|6,2->5,2|3,2->4,2|9,7->3,7', {
  moves: [
    { from: pos(0, 1), to: pos(0, 0), name: '砲8平9 (平炮兑车)' },
    { from: pos(2, 2), to: pos(4, 3), name: '马7进6 (盘河马)' },
    { from: pos(0, 6), to: pos(2, 4), name: '象3进5' },
  ],
  weights: [35, 35, 30],
});

// --- 1B: 五七炮 move 5 (B) after 炮八平七 ---
addSymmetric('7,7->7,4|0,1->2,2|9,7->7,6|0,0->0,1|9,8->9,7|0,7->2,6|6,2->5,2|3,2->4,2|7,1->7,2', {
  moves: [
    { from: pos(2, 7), to: pos(4, 7), name: '砲2进4 (右炮过河)' },
    { from: pos(0, 1), to: pos(2, 1), name: '砲8进2 (巡河炮)' },
    { from: pos(0, 6), to: pos(2, 4), name: '象3进5' },
  ],
  weights: [35, 35, 30],
});

// --- 1C: 七路马 move 5 (B) after 马八进七 ---
addSymmetric('7,7->7,4|0,1->2,2|9,7->7,6|0,0->0,1|9,8->9,7|0,7->2,6|6,2->5,2|3,2->4,2|9,1->7,2', {
  moves: [
    { from: pos(2, 7), to: pos(4, 7), name: '砲2进4 (右炮过河)' },
    { from: pos(0, 6), to: pos(2, 4), name: '象3进5' },
    { from: pos(0, 1), to: pos(0, 0), name: '砲8平9' },
  ],
  weights: [40, 30, 30],
});

// --- 1F: 进三兵 move 5 (B) after 兵三进一+卒3进1+马八进七 ---
addSymmetric('7,7->7,4|0,1->2,2|9,8->9,7|0,7->2,6|6,6->5,6|3,6->4,6|9,1->7,2', {
  moves: [
    { from: pos(0, 1), to: pos(0, 0), name: '砲8平9 (三步虎)' },
    { from: pos(0, 0), to: pos(0, 1), name: '车9平8' },
  ],
  weights: [55, 45],
});

// --- 1F: move 6 (R) after 三步虎 ---
addSymmetric('7,7->7,4|0,1->2,2|9,8->9,7|0,7->2,6|6,6->5,6|3,6->4,6|9,1->7,2|0,1->0,0', {
  moves: [
    { from: pos(9, 0), to: pos(9, 1), name: '车九平八' },
    { from: pos(9, 7), to: pos(3, 7), name: '车二进六' },
  ],
  weights: [55, 45],
});

// --- 1F: move 6 (B) after 车九平八 ---
addSymmetric('7,7->7,4|0,1->2,2|9,8->9,7|0,7->2,6|6,6->5,6|3,6->4,6|9,1->7,2|0,1->0,0|9,0->9,1', {
  moves: [
    { from: pos(0, 8), to: pos(0, 7), name: '车1平2' },
    { from: pos(0, 6), to: pos(2, 4), name: '象3进5' },
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
  // Use opening book for first 18 half-moves (9 full moves)
  if (moveHistory.length > 18) return null;

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
