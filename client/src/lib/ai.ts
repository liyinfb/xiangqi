// AI Engine for Chinese Chess - NegaMax Framework (Optimized)
// Features: Zobrist Hashing, Transposition Table with Age, Null Move Pruning,
// Principal Variation Search (PVS), Quiescence Search, Late Move Reduction (LMR),
// Late Move Pruning (LMP), Internal Iterative Deepening (IID),
// Killer Moves, Counter Move Heuristic, History Heuristic, MVV-LVA,
// Aspiration Windows with gradual widening, Iterative Deepening,
// Futility Pruning, Razoring, Delta Pruning, Check Extensions
// All search uses IN-PLACE make/undo to avoid board cloning
// NegaMax: score is always from the perspective of the CURRENT player to move

import {
  Board,
  PieceColor,
  PieceType,
  Position,
  Piece,
  PIECE_VALUES,
  POSITION_BONUS,
  getAllValidMoves,
  getAllValidMovesFast,
  getCaptureMovesFast,
  getSmallestAttacker,
  isCheckmate,
  isInCheck,
  isInCheckFastExport,
  isSquareAttacked,
  makeMove,
} from './xiangqi';
import { lookupOpeningBook as lookupOpeningBookInternal } from './openingBook';

export type Difficulty = 'easy' | 'medium' | 'hard';

// Depth settings - all difficulties use same max depth, differentiated by time limit only
const DEPTH_MAP: Record<Difficulty, number> = {
  easy: 30,
  medium: 30,
  hard: 30,
};

// Futility pruning margins indexed by depth
const FUTILITY_MARGIN = [0, 200, 350, 500, 650, 800, 950];
// Razoring margin
const RAZOR_MARGIN = 600;

// Use finite bounds instead of Infinity to avoid JS arithmetic issues
const INF = 300000;

// Time limits per difficulty (ms) - the ONLY difference between difficulty levels
const TIME_LIMIT: Record<Difficulty, number> = {
  easy: 500,
  medium: 3000,
  hard: 10000,
};

// Move counter for randomization
let moveCounter = 0;

export function resetMoveCounter(): void {
  moveCounter = 0;
  ttClear();
  historyScores.fill(0);
  counterMoves.fill(-1);
}

// ==================== Zobrist Hashing ====================

const ZOBRIST_TABLE: number[] = [];
const ZOBRIST_TURN: number = 0x5A5A5A5A;

function initZobrist() {
  let seed = 1234567890;
  function nextRand(): number {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed;
  }
  for (let i = 0; i < 1260; i++) {
    ZOBRIST_TABLE.push(nextRand());
  }
}
initZobrist();

const PIECE_TYPE_INDEX: Record<PieceType, number> = {
  general: 0, advisor: 1, elephant: 2, horse: 3, chariot: 4, cannon: 5, soldier: 6,
};

function zobristIndex(row: number, col: number, type: PieceType, color: PieceColor): number {
  const colorOffset = color === 'red' ? 0 : 7;
  return (row * 9 + col) * 14 + PIECE_TYPE_INDEX[type] + colorOffset;
}

export function computeZobristHash(board: Board, turn: PieceColor): number {
  let hash = turn === 'black' ? ZOBRIST_TURN : 0;
  for (let row = 0; row <= 9; row++) {
    for (let col = 0; col <= 8; col++) {
      const piece = board[row][col];
      if (piece) {
        hash ^= ZOBRIST_TABLE[zobristIndex(row, col, piece.type, piece.color)];
      }
    }
  }
  return hash;
}

// Incremental hash update
function updateHash(hash: number, fromRow: number, fromCol: number, toRow: number, toCol: number, piece: Piece, captured: Piece | null): number {
  hash ^= ZOBRIST_TABLE[zobristIndex(fromRow, fromCol, piece.type, piece.color)];
  if (captured) {
    hash ^= ZOBRIST_TABLE[zobristIndex(toRow, toCol, captured.type, captured.color)];
  }
  hash ^= ZOBRIST_TABLE[zobristIndex(toRow, toCol, piece.type, piece.color)];
  hash ^= ZOBRIST_TURN;
  return hash;
}

// ==================== Transposition Table with Age ====================

const TT_EXACT = 0;
const TT_LOWERBOUND = 1;
const TT_UPPERBOUND = 2;

// Flat array TT for better cache performance
// Each entry: [hash, depth, score, flag, fromRow, fromCol, toRow, toCol, age]
// Using typed arrays for compactness
const TT_SIZE = 1 << 20; // ~1M entries
const TT_MASK = TT_SIZE - 1;
const TT_FIELDS = 9;
const ttData = new Int32Array(TT_SIZE * TT_FIELDS);
const ttOccupied = new Uint8Array(TT_SIZE); // 0 = empty, 1 = occupied
let ttAge = 0; // Incremented each search iteration

function ttProbe(hash: number, depth: number, alpha: number, beta: number): { score: number; flag: number; bestMove: { fromRow: number; fromCol: number; toRow: number; toCol: number } | null } | null {
  const idx = (hash & TT_MASK) * TT_FIELDS;
  if (!ttOccupied[hash & TT_MASK] || ttData[idx] !== hash) return null;

  const entryDepth = ttData[idx + 1];
  const entryScore = ttData[idx + 2];
  const entryFlag = ttData[idx + 3];
  const fr = ttData[idx + 4];
  const fc = ttData[idx + 5];
  const tr = ttData[idx + 6];
  const tc = ttData[idx + 7];

  const bestMove = fr >= 0 ? { fromRow: fr, fromCol: fc, toRow: tr, toCol: tc } : null;

  if (entryDepth >= depth) {
    if (entryFlag === TT_EXACT) return { score: entryScore, flag: TT_EXACT, bestMove };
    if (entryFlag === TT_LOWERBOUND && entryScore >= beta) return { score: entryScore, flag: TT_LOWERBOUND, bestMove };
    if (entryFlag === TT_UPPERBOUND && entryScore <= alpha) return { score: entryScore, flag: TT_UPPERBOUND, bestMove };
  }

  return { score: 0, flag: -1, bestMove };
}

function ttStore(hash: number, depth: number, score: number, flag: number, fromRow: number, fromCol: number, toRow: number, toCol: number): void {
  const slot = hash & TT_MASK;
  const idx = slot * TT_FIELDS;

  // Replace if: empty, same hash, deeper search, or old age
  if (!ttOccupied[slot] ||
      ttData[idx] === hash ||
      ttData[idx + 1] <= depth ||
      ttData[idx + 8] < ttAge) {
    ttOccupied[slot] = 1;
    ttData[idx] = hash;
    ttData[idx + 1] = depth;
    ttData[idx + 2] = score;
    ttData[idx + 3] = flag;
    ttData[idx + 4] = fromRow;
    ttData[idx + 5] = fromCol;
    ttData[idx + 6] = toRow;
    ttData[idx + 7] = toCol;
    ttData[idx + 8] = ttAge;
  }
}

export function ttClear(): void {
  ttOccupied.fill(0);
  ttAge = 0;
}

/** Reset ALL mutable search state — use between independent test positions */
export function resetSearchState(): void {
  ttClear();
  historyScores.fill(0);
  killerFrom1.fill(-1);
  killerTo1.fill(-1);
  killerFrom2.fill(-1);
  killerTo2.fill(-1);
  counterMoves.fill(-1);
  gamePositionHashes = [];
  searchPathHashes = [];
  moveCounter = 0;
}

// ==================== Enhanced Evaluation ====================

const EVAL_PIECE_VALUES: Record<PieceType, number> = {
  general: 100000, advisor: 200, elephant: 200, horse: 480, chariot: 1000, cannon: 510, soldier: 100,
};

const SOLDIER_CROSSED_VALUE = 220;

// Pre-computed position-piece tables (flat arrays for speed)
const EVAL_TABLE_RED: Record<PieceType, number[][]> = {} as any;
const EVAL_TABLE_BLACK: Record<PieceType, number[][]> = {} as any;

// Flat evaluation tables for fastest access
const EVAL_FLAT_RED = new Int16Array(7 * 90); // 7 piece types * 90 squares
const EVAL_FLAT_BLACK = new Int16Array(7 * 90);

function initEvalTables() {
  const types: PieceType[] = ['general', 'advisor', 'elephant', 'horse', 'chariot', 'cannon', 'soldier'];
  for (let ti = 0; ti < types.length; ti++) {
    const type = types[ti];
    EVAL_TABLE_RED[type] = Array(10).fill(null).map((_, row) =>
      Array(9).fill(null).map((_, col) => {
        let base = EVAL_PIECE_VALUES[type];
        if (type === 'soldier' && row <= 4) base = SOLDIER_CROSSED_VALUE;
        const val = base + POSITION_BONUS[type][row][col] * 5;
        EVAL_FLAT_RED[ti * 90 + row * 9 + col] = val;
        return val;
      })
    );
    EVAL_TABLE_BLACK[type] = Array(10).fill(null).map((_, row) =>
      Array(9).fill(null).map((_, col) => {
        let base = EVAL_PIECE_VALUES[type];
        if (type === 'soldier' && row >= 5) base = SOLDIER_CROSSED_VALUE;
        const val = base + POSITION_BONUS[type][9 - row][col] * 5;
        EVAL_FLAT_BLACK[ti * 90 + row * 9 + col] = val;
        return val;
      })
    );
  }
}
initEvalTables();

// Hanging piece penalty weights (fraction of piece value to penalize)
// A hanging piece (attacked but undefended) loses a significant fraction of its value in eval
const HANGING_PENALTY_FRACTION = 0.4; // 40% of piece value
const ATTACKED_DEFENDED_PENALTY_FRACTION = 0.1; // 10% penalty for attacked-but-defended pieces

// NegaMax evaluation: returns score from the perspective of `currentTurn`
// Development bonus: reward pieces that have moved from their starting positions
// This encourages the AI to develop pieces in the opening rather than making
// aimless moves. The bonus is small enough not to override tactical considerations
// but large enough to break ties between equally-scored moves.
const DEV_BONUS = 8; // per developed piece

function countDevelopment(board: Board, color: PieceColor): number {
  let developed = 0;
  if (color === 'red') {
    // Red horses: starting at (9,1) and (9,7)
    if (!(board[9][1]?.type === 'horse' && board[9][1]?.color === 'red')) developed++;
    if (!(board[9][7]?.type === 'horse' && board[9][7]?.color === 'red')) developed++;
    // Red chariots: starting at (9,0) and (9,8)
    if (!(board[9][0]?.type === 'chariot' && board[9][0]?.color === 'red')) developed++;
    if (!(board[9][8]?.type === 'chariot' && board[9][8]?.color === 'red')) developed++;
    // Red cannons: starting at (7,1) and (7,7) - reward moving to central/active positions
    if (!(board[7][1]?.type === 'cannon' && board[7][1]?.color === 'red')) developed++;
    if (!(board[7][7]?.type === 'cannon' && board[7][7]?.color === 'red')) developed++;
  } else {
    // Black horses: starting at (0,1) and (0,7)
    if (!(board[0][1]?.type === 'horse' && board[0][1]?.color === 'black')) developed++;
    if (!(board[0][7]?.type === 'horse' && board[0][7]?.color === 'black')) developed++;
    // Black chariots: starting at (0,0) and (0,8)
    if (!(board[0][0]?.type === 'chariot' && board[0][0]?.color === 'black')) developed++;
    if (!(board[0][8]?.type === 'chariot' && board[0][8]?.color === 'black')) developed++;
    // Black cannons: starting at (2,1) and (2,7)
    if (!(board[2][1]?.type === 'cannon' && board[2][1]?.color === 'black')) developed++;
    if (!(board[2][7]?.type === 'cannon' && board[2][7]?.color === 'black')) developed++;
  }
  return developed;
}

function evaluateForSide(board: Board, currentTurn: PieceColor): number {
  let score = 0;
  const oppColor = currentTurn === 'red' ? 'black' : 'red';
  
  for (let row = 0; row <= 9; row++) {
    for (let col = 0; col <= 8; col++) {
      const piece = board[row][col];
      if (!piece) continue;
      const ti = PIECE_TYPE_INDEX[piece.type];
      const sq = row * 9 + col;
      const value = piece.color === 'red'
        ? EVAL_FLAT_RED[ti * 90 + sq]
        : EVAL_FLAT_BLACK[ti * 90 + sq];
      if (piece.color === currentTurn) score += value;
      else score -= value;
    }
  }
  
  // Development bonus: encourage piece development in the opening
  const myDev = countDevelopment(board, currentTurn);
  const oppDev = countDevelopment(board, oppColor);
  score += (myDev - oppDev) * DEV_BONUS;
  
  // Cannon forward penalty: penalize cannons that have moved forward into
  // no-man's land (rows 4-5 for red, rows 4-5 for black) on the flanks.
  // Cannons are strongest on the back rank controlling through screens.
  // This prevents the AI from making aimless cannon pushes in the opening.
  for (let row = 0; row <= 9; row++) {
    for (let col = 0; col <= 8; col++) {
      const piece = board[row][col];
      if (!piece || piece.type !== 'cannon') continue;
      
      // Check if cannon is in "no man's land" - forward but not on a useful file
      if (piece.color === 'red') {
        // Red cannon in rows 4-6 (forward of back rank but not deep) on edge files
        if (row >= 3 && row <= 6 && (col <= 1 || col >= 7)) {
          const penalty = 15;
          if (piece.color === currentTurn) score -= penalty;
          else score += penalty;
        }
      } else {
        // Black cannon in rows 3-6 on edge files
        if (row >= 3 && row <= 6 && (col <= 1 || col >= 7)) {
          const penalty = 15;
          if (piece.color === currentTurn) score -= penalty;
          else score += penalty;
        }
      }
    }
  }
  
  // Hanging piece penalty: penalize pieces that are attacked by the opponent
  // Only check major pieces (chariot, cannon, horse) to keep evaluation fast
  for (let row = 0; row <= 9; row++) {
    for (let col = 0; col <= 8; col++) {
      const piece = board[row][col];
      if (!piece) continue;
      // Only check valuable pieces (skip soldiers, advisors, elephants for speed)
      if (piece.type !== 'chariot' && piece.type !== 'cannon' && piece.type !== 'horse') continue;
      
      const pieceVal = EVAL_PIECE_VALUES[piece.type];
      const attackedBy = piece.color === currentTurn ? oppColor : currentTurn;
      
      if (isSquareAttacked(board, row, col, attackedBy)) {
        const defendedBy = piece.color;
        const isDefended = isSquareAttacked(board, row, col, defendedBy);
        
        if (!isDefended) {
          const penalty = Math.floor(pieceVal * HANGING_PENALTY_FRACTION);
          if (piece.color === currentTurn) score -= penalty;
          else score += penalty;
        } else {
          const penalty = Math.floor(pieceVal * ATTACKED_DEFENDED_PENALTY_FRACTION);
          if (piece.color === currentTurn) score -= penalty;
          else score += penalty;
        }
      }
    }
  }
  
  // ---- King Safety ----
  // Reward having advisors and elephants near the general (palace defense)
  let myKingSafety = 0;
  let oppKingSafety = 0;
  
  // Find generals
  let myKingRow = -1, myKingCol = -1, oppKingRow = -1, oppKingCol = -1;
  for (let row = 0; row <= 9; row++) {
    for (let col = 3; col <= 5; col++) {
      const p = board[row][col];
      if (p && p.type === 'general') {
        if (p.color === currentTurn) { myKingRow = row; myKingCol = col; }
        else { oppKingRow = row; oppKingCol = col; }
      }
    }
  }
  
  // Count defenders around each general
  if (myKingRow >= 0) {
    const kRow = myKingRow, kCol = myKingCol;
    // Check adjacent squares for advisors/elephants
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const r = kRow + dr, c = kCol + dc;
        if (r < 0 || r > 9 || c < 0 || c > 8) continue;
        const p = board[r][c];
        if (p && p.color === currentTurn && (p.type === 'advisor' || p.type === 'elephant')) {
          myKingSafety += 8;
        }
      }
    }
  }
  if (oppKingRow >= 0) {
    const kRow = oppKingRow, kCol = oppKingCol;
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const r = kRow + dr, c = kCol + dc;
        if (r < 0 || r > 9 || c < 0 || c > 8) continue;
        const p = board[r][c];
        if (p && p.color === oppColor && (p.type === 'advisor' || p.type === 'elephant')) {
          oppKingSafety += 8;
        }
      }
    }
  }
  score += myKingSafety - oppKingSafety;
  
  // ---- Piece Coordination: Chariot on open file ----
  // Reward chariots that are on files with no friendly pawns blocking them
  for (let row = 0; row <= 9; row++) {
    for (let col = 0; col <= 8; col++) {
      const piece = board[row][col];
      if (!piece || piece.type !== 'chariot') continue;
      
      // Check if the file (column) is open (no friendly soldiers on it)
      let fileBlocked = false;
      for (let r = 0; r <= 9; r++) {
        if (r === row) continue;
        const p = board[r][col];
        if (p && p.color === piece.color && p.type === 'soldier') {
          fileBlocked = true;
          break;
        }
      }
      
      if (!fileBlocked) {
        const bonus = 12; // Open file bonus for chariot
        if (piece.color === currentTurn) score += bonus;
        else score -= bonus;
      }
    }
  }
  
  // ---- Piece Coordination: Connected chariots ----
  // Reward two chariots of the same color on the same rank or file with nothing between
  // (simplified: just check if both chariots exist and are on same rank/file)
  let myChariots: { row: number; col: number }[] = [];
  let oppChariots: { row: number; col: number }[] = [];
  for (let row = 0; row <= 9; row++) {
    for (let col = 0; col <= 8; col++) {
      const p = board[row][col];
      if (p && p.type === 'chariot') {
        if (p.color === currentTurn) myChariots.push({ row, col });
        else oppChariots.push({ row, col });
      }
    }
  }
  if (myChariots.length === 2) {
    if (myChariots[0].row === myChariots[1].row || myChariots[0].col === myChariots[1].col) {
      score += 15; // Connected chariots bonus
    }
  }
  if (oppChariots.length === 2) {
    if (oppChariots[0].row === oppChariots[1].row || oppChariots[0].col === oppChariots[1].col) {
      score -= 15;
    }
  }
  
  return score;
}

// Legacy evaluation for root-level AI color perspective (used in easy mode & describeMoveContext)
function evaluateBoard(board: Board, aiColor: PieceColor): number {
  return evaluateForSide(board, aiColor);
}

// ==================== Move Ordering ====================

const historyScores: Int32Array = new Int32Array(90 * 90);
const MAX_PLY = 64;
const killerFrom1: Int8Array = new Int8Array(MAX_PLY).fill(-1);
const killerTo1: Int8Array = new Int8Array(MAX_PLY).fill(-1);
const killerFrom2: Int8Array = new Int8Array(MAX_PLY).fill(-1);
const killerTo2: Int8Array = new Int8Array(MAX_PLY).fill(-1);

// Counter Move Heuristic: indexed by [from_sq * 90 + to_sq] -> best response move encoded
// Stores the move that refuted the opponent's previous move
const counterMoves: Int32Array = new Int32Array(90 * 90).fill(-1);

function posIdx(row: number, col: number): number {
  return row * 9 + col;
}

function encodeMove(fr: number, fc: number, tr: number, tc: number): number {
  return (fr << 12) | (fc << 8) | (tr << 4) | tc;
}

function addKiller(fromRow: number, fromCol: number, toRow: number, toCol: number, ply: number): void {
  if (ply >= MAX_PLY) return;
  const fi = posIdx(fromRow, fromCol);
  const ti = posIdx(toRow, toCol);
  if (killerFrom1[ply] !== fi || killerTo1[ply] !== ti) {
    killerFrom2[ply] = killerFrom1[ply];
    killerTo2[ply] = killerTo1[ply];
    killerFrom1[ply] = fi;
    killerTo1[ply] = ti;
  }
}

function isKiller(fromRow: number, fromCol: number, toRow: number, toCol: number, ply: number): boolean {
  if (ply >= MAX_PLY) return false;
  const fi = posIdx(fromRow, fromCol);
  const ti = posIdx(toRow, toCol);
  return (killerFrom1[ply] === fi && killerTo1[ply] === ti) ||
    (killerFrom2[ply] === fi && killerTo2[ply] === ti);
}

// Pre-computed LMR reduction table
const LMR_TABLE = new Uint8Array(64 * 64);
function initLMR() {
  for (let d = 1; d < 64; d++) {
    for (let m = 1; m < 64; m++) {
      LMR_TABLE[d * 64 + m] = Math.max(1, Math.min(Math.floor(Math.log(d) * Math.log(m) * 0.5), d - 1));
    }
  }
}
initLMR();

// Compact move representation for sorting
interface ScoredMove {
  fromRow: number;
  fromCol: number;
  toRow: number;
  toCol: number;
  score: number;
}

// Previous move tracking for counter move heuristic
let prevMoveFrom = -1;
let prevMoveTo = -1;

function generateScoredMoves(
  board: Board,
  moves: { from: Position; to: Position }[],
  ply: number,
  ttMove: { fromRow: number; fromCol: number; toRow: number; toCol: number } | null
): ScoredMove[] {
  const len = moves.length;
  const scored: ScoredMove[] = new Array(len);
  
  // Get counter move for this position
  let counterFr = -1, counterFc = -1, counterTr = -1, counterTc = -1;
  if (prevMoveFrom >= 0) {
    const cmIdx = prevMoveFrom * 90 + prevMoveTo;
    const cm = counterMoves[cmIdx];
    if (cm >= 0) {
      counterFr = (cm >> 12) & 0xF;
      counterFc = (cm >> 8) & 0xF;
      counterTr = (cm >> 4) & 0xF;
      counterTc = cm & 0xF;
    }
  }

  for (let i = 0; i < len; i++) {
    const m = moves[i];
    const fr = m.from.row, fc = m.from.col, tr = m.to.row, tc = m.to.col;
    let s = 0;

    // TT move highest priority
    if (ttMove && fr === ttMove.fromRow && fc === ttMove.fromCol && tr === ttMove.toRow && tc === ttMove.toCol) {
      s = 10000000;
    } else {
      const captured = board[tr][tc];
      if (captured) {
        const attacker = board[fr][fc]!;
        // MVV-LVA base score, then demote losing captures via SEE
        const mvvlva = EVAL_PIECE_VALUES[captured.type] * 10 - EVAL_PIECE_VALUES[attacker.type];
        if (seeGe(board, fr, fc, tr, tc, 0)) {
          s = 1000000 + mvvlva; // Winning/equal capture: high priority
        } else {
          s = 100000 + mvvlva; // Losing capture: below killers/counters but above quiet moves
        }
      } else if (isKiller(fr, fc, tr, tc, ply)) {
        s = 900000;
      } else if (fr === counterFr && fc === counterFc && tr === counterTr && tc === counterTc) {
        // Counter move bonus
        s = 850000;
      } else {
        s = historyScores[posIdx(fr, fc) * 90 + posIdx(tr, tc)];
      }
    }
    scored[i] = { fromRow: fr, fromCol: fc, toRow: tr, toCol: tc, score: s };
  }
  
  // Insertion sort (good for nearly-sorted arrays from iterative deepening)
  for (let i = 1; i < len; i++) {
    const item = scored[i];
    let j = i - 1;
    while (j >= 0 && scored[j].score < item.score) {
      scored[j + 1] = scored[j];
      j--;
    }
    scored[j + 1] = item;
  }
  return scored;
}

// ==================== Board Symmetry Detection ====================

/** Check if the board is left-right symmetric (mirror along column 4) */
function isBoardSymmetric(board: Board): boolean {
  for (let row = 0; row <= 9; row++) {
    for (let col = 0; col <= 3; col++) {
      const left = board[row][col];
      const right = board[row][8 - col];
      if (left === null && right === null) continue;
      if (left === null || right === null) return false;
      if (left.type !== right.type || left.color !== right.color) return false;
    }
  }
  return true;
}

// ==================== Static Exchange Evaluation (SEE) ====================

// SEE evaluates a capture sequence to determine if a capture is winning.
// Uses save/restore approach to properly handle board modifications.
function see(board: Board, fromRow: number, fromCol: number, toRow: number, toCol: number): number {
  const target = board[toRow][toCol];
  if (!target) return 0;
  
  const attacker = board[fromRow][fromCol];
  if (!attacker) return 0;
  
  // Save all modified squares for restoration
  const savedSquares: { row: number; col: number; piece: Piece | null }[] = [];
  function saveSq(r: number, c: number) {
    savedSquares.push({ row: r, col: c, piece: board[r][c] });
  }
  function restoreAll() {
    for (let i = savedSquares.length - 1; i >= 0; i--) {
      const s = savedSquares[i];
      board[s.row][s.col] = s.piece;
    }
  }
  
  // Gain array: gains[d] = value captured at depth d
  const gains = new Int32Array(32);
  gains[0] = EVAL_PIECE_VALUES[target.type];
  
  let currentAttackerValue = EVAL_PIECE_VALUES[attacker.type];
  let currentColor: PieceColor = attacker.color === 'red' ? 'black' : 'red';
  
  // Simulate initial capture
  saveSq(fromRow, fromCol);
  saveSq(toRow, toCol);
  board[toRow][toCol] = attacker;
  board[fromRow][fromCol] = null;
  
  let d = 1;
  while (d < 32) {
    const nextAttacker = getSmallestAttacker(board, toRow, toCol, currentColor);
    if (!nextAttacker) break;
    
    gains[d] = currentAttackerValue - gains[d - 1];
    
    // Pruning: if max of standing pat and capturing is negative, stop
    if (Math.max(-gains[d - 1], gains[d]) < 0) break;
    
    currentAttackerValue = nextAttacker.value;
    
    // Simulate this capture
    saveSq(nextAttacker.row, nextAttacker.col);
    saveSq(toRow, toCol);
    board[toRow][toCol] = board[nextAttacker.row][nextAttacker.col];
    board[nextAttacker.row][nextAttacker.col] = null;
    
    currentColor = currentColor === 'red' ? 'black' : 'red';
    d++;
  }
  
  // Restore board to original state
  restoreAll();
  
  // Negamax on gains to find the optimal exchange value
  while (--d > 0) {
    gains[d - 1] = -Math.max(-gains[d - 1], gains[d]);
  }
  
  return gains[0];
}

// Fast SEE threshold check: returns true if SEE >= threshold
function seeGe(board: Board, fromRow: number, fromCol: number, toRow: number, toCol: number, threshold: number): boolean {
  const target = board[toRow][toCol];
  if (!target) return threshold <= 0;
  
  const attacker = board[fromRow][fromCol];
  if (!attacker) return false;
  
  // Quick bounds check
  let balance = EVAL_PIECE_VALUES[target.type] - threshold;
  if (balance < 0) return false;
  
  balance -= EVAL_PIECE_VALUES[attacker.type];
  if (balance >= 0) return true;
  
  return see(board, fromRow, fromCol, toRow, toCol) >= threshold;
}

// ==================== In-Place Make/Undo ====================

function makeMoveInPlace(board: Board, fromRow: number, fromCol: number, toRow: number, toCol: number): Piece | null {
  const captured = board[toRow][toCol];
  board[toRow][toCol] = board[fromRow][fromCol];
  board[fromRow][fromCol] = null;
  return captured;
}

function undoMoveInPlace(board: Board, fromRow: number, fromCol: number, toRow: number, toCol: number, piece: Piece, captured: Piece | null): void {
  board[fromRow][fromCol] = piece;
  board[toRow][toCol] = captured;
}

// ==================== Search State ====================

let searchAborted = false;
let nodesSearched = 0;
let startTime = 0;
let timeLimit = 0;

// Position history for repetition detection
let gamePositionHashes: number[] = [];
let searchPathHashes: number[] = [];

function isRepetition(hash: number): boolean {
  // Check in game history
  let count = 0;
  for (let i = 0; i < gamePositionHashes.length; i++) {
    if (gamePositionHashes[i] === hash) {
      count++;
      if (count >= 2) return true;
    }
  }
  // Check in current search path
  for (let i = 0; i < searchPathHashes.length - 1; i++) {
    if (searchPathHashes[i] === hash) return true;
  }
  return false;
}

// ==================== Quiescence Search (NegaMax) ====================

function quiescence(
  board: Board,
  alpha: number,
  beta: number,
  currentTurn: PieceColor,
  hash: number,
  qDepth: number
): number {
  nodesSearched++;

  // Time check in quiescence too (every 8192 nodes)
  if ((nodesSearched & 8191) === 0) {
    if (Date.now() - startTime > timeLimit) {
      searchAborted = true;
      return 0;
    }
  }

  const inCheck = isInCheckFastExport(board, currentTurn);
  
  // If in check, we must search all evasions (don't use stand pat)
  if (inCheck) {
    if (qDepth <= -4) return evaluateForSide(board, currentTurn); // Safety limit
    
    const evasions = getAllValidMovesFast(board, currentTurn);
    if (evasions.length === 0) return -200000; // Checkmate
    
    let bestScore = -INF;
    const nextTurn = currentTurn === 'red' ? 'black' : 'red';
    
    for (let i = 0; i < evasions.length; i++) {
      const m = evasions[i];
      const piece = board[m.from.row][m.from.col]!;
      const captured = makeMoveInPlace(board, m.from.row, m.from.col, m.to.row, m.to.col);
      const newHash = updateHash(hash, m.from.row, m.from.col, m.to.row, m.to.col, piece, captured);
      
      const score = -quiescence(board, -beta, -alpha, nextTurn, newHash, qDepth - 1);
      
      undoMoveInPlace(board, m.from.row, m.from.col, m.to.row, m.to.col, piece, captured);
      
      if (searchAborted) return 0;
      if (score > bestScore) bestScore = score;
      if (score > alpha) alpha = score;
      if (alpha >= beta) return beta;
    }
    
    return bestScore;
  }

  const standPat = evaluateForSide(board, currentTurn);

  if (qDepth <= 0) return standPat;

  if (standPat >= beta) return beta;
  if (standPat > alpha) alpha = standPat;

  // Generate captures
  const captureMoves = getCaptureMovesFast(board, currentTurn);

  // Build local capture list with SEE values for sorting
  const captures: { fr: number; fc: number; tr: number; tc: number; vv: number }[] = [];
  for (let i = 0; i < captureMoves.length; i++) {
    const m = captureMoves[i];
    const victim = board[m.to.row][m.to.col];
    if (victim) {
      captures.push({
        fr: m.from.row, fc: m.from.col,
        tr: m.to.row, tc: m.to.col,
        vv: EVAL_PIECE_VALUES[victim.type]
      });
    }
  }

  // Sort by victim value descending (MVV)
  captures.sort((a, b) => b.vv - a.vv);

  const DELTA = 200;
  const nextTurn = currentTurn === 'red' ? 'black' : 'red';

  for (let ci = 0; ci < captures.length; ci++) {
    const cap = captures[ci];
    // Delta pruning
    if (standPat + cap.vv + DELTA < alpha) continue;
    
    // SEE pruning in quiescence: skip losing captures
    if (!seeGe(board, cap.fr, cap.fc, cap.tr, cap.tc, 0)) continue;

    const piece = board[cap.fr][cap.fc]!;
    const captured = makeMoveInPlace(board, cap.fr, cap.fc, cap.tr, cap.tc);
    const newHash = updateHash(hash, cap.fr, cap.fc, cap.tr, cap.tc, piece, captured);

    const score = -quiescence(board, -beta, -alpha, nextTurn, newHash, qDepth - 1);

    undoMoveInPlace(board, cap.fr, cap.fc, cap.tr, cap.tc, piece, captured);

    if (searchAborted) return 0;
    if (score >= beta) return beta;
    if (score > alpha) alpha = score;
  }

  return alpha;
}

// ==================== Principal Variation Search (NegaMax) ====================

// Late Move Pruning thresholds by depth
const LMP_THRESHOLD = [0, 5, 8, 12, 16, 20, 24, 28];

function pvs(
  board: Board,
  depth: number,
  alpha: number,
  beta: number,
  currentTurn: PieceColor,
  hash: number,
  ply: number,
  nullMoveAllowed: boolean
): number {
  if (searchAborted) return 0;

  // Time check every 4096 nodes (slightly less frequent for speed)
  nodesSearched++;
  if ((nodesSearched & 4095) === 0) {
    if (Date.now() - startTime > timeLimit) {
      searchAborted = true;
      return 0;
    }
  }

  // Repetition detection
  if (ply > 0 && isRepetition(hash)) {
    return 0;
  }

  const inCheck = isInCheckFastExport(board, currentTurn);

  // Check extension
  if (inCheck) depth++;

  // Leaf node
  if (depth <= 0) {
    return quiescence(board, alpha, beta, currentTurn, hash, 6);
  }

  // Mate distance pruning
  const mateScore = 200000 - ply;
  if (mateScore < beta) {
    beta = mateScore;
    if (alpha >= mateScore) return mateScore;
  }
  const matedScore = -200000 + ply;
  if (matedScore > alpha) {
    alpha = matedScore;
    if (beta <= matedScore) return matedScore;
  }

  // TT probe
  const ttResult = ttProbe(hash, depth, alpha, beta);
  if (ttResult && ttResult.flag >= 0) {
    return ttResult.score;
  }
  const ttMove = ttResult?.bestMove || null;

  const isPV = beta - alpha > 1;

  // Razoring
  if (!isPV && !inCheck && depth <= 3 && ply > 0) {
    const staticEval = evaluateForSide(board, currentTurn);
    if (staticEval + RAZOR_MARGIN < alpha) {
      const qScore = quiescence(board, alpha, beta, currentTurn, hash, 6);
      if (qScore < alpha) return qScore;
    }
  }

  // Null Move Pruning
  if (nullMoveAllowed && !inCheck && depth >= 3 && ply > 0 && !isPV) {
    let hasMaterial = false;
    for (let r = 0; r <= 9; r++) {
      for (let c = 0; c <= 8; c++) {
        const p = board[r][c];
        if (p && p.color === currentTurn) {
          const t = p.type;
          if (t === 'chariot' || t === 'cannon' || t === 'horse') {
            hasMaterial = true; r = 10; break;
          }
        }
      }
    }

    if (hasMaterial) {
      const R = depth >= 8 ? 4 : depth >= 6 ? 3 : 2;
      const nextTurn = currentTurn === 'red' ? 'black' : 'red';
      const nullHash = hash ^ ZOBRIST_TURN;

      const nullScore = -pvs(board, depth - 1 - R, -beta, -beta + 1, nextTurn, nullHash, ply + 1, false);

      if (searchAborted) return 0;
      if (nullScore >= beta) return beta;
    }
  }

  // Reverse Futility Pruning (Static Null Move Pruning)
  // If our position is so good that even after giving a margin, we're still above beta,
  // we can prune this node without searching.
  if (!isPV && !inCheck && depth <= 6 && ply > 0) {
    const rfpEval = evaluateForSide(board, currentTurn);
    const rfpMargin = depth * 120; // ~120 per depth
    if (rfpEval - rfpMargin >= beta) {
      return rfpEval;
    }
  }

  // Internal Iterative Deepening (IID)
  // When no TT move is available at high depth, do a shallow search first
  // to get a good move for ordering
  let iidMove: { fromRow: number; fromCol: number; toRow: number; toCol: number } | null = ttMove;
  if (!iidMove && depth >= 6 && isPV) {
    const iidDepth = Math.max(1, depth - 4);
    pvs(board, iidDepth, alpha, beta, currentTurn, hash, ply, false);
    if (!searchAborted) {
      const iidResult = ttProbe(hash, 0, -INF, INF);
      if (iidResult?.bestMove) {
        iidMove = iidResult.bestMove;
      }
    }
  }

  // Generate moves
  const allMoves = getAllValidMovesFast(board, currentTurn);
  if (allMoves.length === 0) {
    if (inCheck) return -200000 + ply;
    return 0;
  }

  // Static eval for futility and LMP
  const staticEvalForFutility = (!inCheck && depth <= 6) ? evaluateForSide(board, currentTurn) : 0;

  // Sort moves
  const scoredMoves = generateScoredMoves(board, allMoves, ply, iidMove);

  const nextTurn = currentTurn === 'red' ? 'black' : 'red';
  let bestScore = -INF;
  let bestFromRow = -1, bestFromCol = -1, bestToRow = -1, bestToCol = -1;
  let flag = TT_UPPERBOUND;
  let movesSearched = 0;

  // Save previous move for counter move tracking
  const savedPrevFrom = prevMoveFrom;
  const savedPrevTo = prevMoveTo;

  for (let i = 0; i < scoredMoves.length; i++) {
    const sm = scoredMoves[i];
    const piece = board[sm.fromRow][sm.fromCol]!;
    const captured = board[sm.toRow][sm.toCol];
    const isCapture = captured !== null;
    const isTTMove = iidMove && sm.fromRow === iidMove.fromRow && sm.fromCol === iidMove.fromCol && sm.toRow === iidMove.toRow && sm.toCol === iidMove.toCol;

    // Late Move Pruning (LMP): skip quiet late moves at low depths
    if (!isPV && !inCheck && depth <= 7 && movesSearched > 0 && !isCapture && !isTTMove) {
      const lmpThresh = LMP_THRESHOLD[depth] || 28;
      if (movesSearched >= lmpThresh) continue;
    }

    // Futility Pruning
    if (!inCheck && depth <= 4 && movesSearched > 0 && !isCapture) {
      const margin = FUTILITY_MARGIN[depth] || 950;
      if (staticEvalForFutility + margin < alpha) continue;
    }

    // SEE-based pruning: skip captures with negative SEE at low depths (bad captures)
    if (!isPV && !inCheck && isCapture && movesSearched > 0 && !isTTMove && depth <= 6) {
      if (!seeGe(board, sm.fromRow, sm.fromCol, sm.toRow, sm.toCol, 0)) {
        continue; // Losing capture, skip it
      }
    }

    // Make move in place
    makeMoveInPlace(board, sm.fromRow, sm.fromCol, sm.toRow, sm.toCol);
    const newHash = updateHash(hash, sm.fromRow, sm.fromCol, sm.toRow, sm.toCol, piece, captured);

    // Track position in search path
    searchPathHashes.push(newHash);

    // Update previous move for counter move heuristic
    prevMoveFrom = posIdx(sm.fromRow, sm.fromCol);
    prevMoveTo = posIdx(sm.toRow, sm.toCol);

    let score: number;

    if (movesSearched === 0) {
      // Full window search for first move (PV move)
      score = -pvs(board, depth - 1, -beta, -alpha, nextTurn, newHash, ply + 1, true);
    } else {
      // Late Move Reduction
      let reduction = 0;
      if (depth >= 3 && movesSearched >= 2 && !inCheck) {
        const newInCheck = isInCheckFastExport(board, nextTurn);
        if (!newInCheck) {
          if (!isCapture) {
            // Use pre-computed LMR table for quiet moves
            const d = Math.min(depth, 63);
            const m = Math.min(movesSearched, 63);
            reduction = LMR_TABLE[d * 64 + m];
            
            // Reduce less for killer moves and counter moves
            if (isKiller(sm.fromRow, sm.fromCol, sm.toRow, sm.toCol, ply)) {
              reduction = Math.max(0, reduction - 1);
            }
            // Reduce more for moves with bad history
            const histIdx = posIdx(sm.fromRow, sm.fromCol) * 90 + posIdx(sm.toRow, sm.toCol);
            if (historyScores[histIdx] < 0) {
              reduction += 1;
            }
          } else {
            // For captures: reduce bad captures (negative SEE) more aggressively
            // Good captures (positive SEE) get no reduction
            if (depth >= 4 && !seeGe(board, sm.fromRow, sm.fromCol, sm.toRow, sm.toCol, 0)) {
              reduction = 1; // Mild reduction for bad captures that passed earlier pruning
            }
          }
          // Reduce less in PV nodes
          if (isPV) {
            reduction = Math.max(0, reduction - 1);
          }
          reduction = Math.min(reduction, depth - 2);
          reduction = Math.max(0, reduction);
        }
      }

      // PVS null window search with reduction
      score = -pvs(board, depth - 1 - reduction, -alpha - 1, -alpha, nextTurn, newHash, ply + 1, true);

      // Re-search with full window if null window failed high
      if (!searchAborted && score > alpha && (score < beta || reduction > 0)) {
        score = -pvs(board, depth - 1, -beta, -alpha, nextTurn, newHash, ply + 1, true);
      }
    }

    // Remove from search path
    searchPathHashes.pop();

    // Restore previous move
    prevMoveFrom = savedPrevFrom;
    prevMoveTo = savedPrevTo;

    // Undo move in place
    undoMoveInPlace(board, sm.fromRow, sm.fromCol, sm.toRow, sm.toCol, piece, captured);

    if (searchAborted) return 0;

    movesSearched++;

    if (score > bestScore) {
      bestScore = score;
      bestFromRow = sm.fromRow; bestFromCol = sm.fromCol;
      bestToRow = sm.toRow; bestToCol = sm.toCol;
    }

    if (score > alpha) {
      alpha = score;
      flag = TT_EXACT;
    }

    if (alpha >= beta) {
      // Beta cutoff - update move ordering heuristics
      if (!isCapture) {
        addKiller(sm.fromRow, sm.fromCol, sm.toRow, sm.toCol, ply);
        
        // History heuristic with bonus/malus
        const histIdx = posIdx(sm.fromRow, sm.fromCol) * 90 + posIdx(sm.toRow, sm.toCol);
        const bonus = depth * depth;
        historyScores[histIdx] += bonus;
        // Penalize all previously searched quiet moves (history malus)
        for (let prev = 0; prev < i; prev++) {
          const pm = scoredMoves[prev];
          if (!board[pm.toRow][pm.toCol]) { // quiet move
            const pIdx = posIdx(pm.fromRow, pm.fromCol) * 90 + posIdx(pm.toRow, pm.toCol);
            historyScores[pIdx] -= bonus;
          }
        }
        
        // Counter move heuristic
        if (savedPrevFrom >= 0) {
          const cmIdx = savedPrevFrom * 90 + savedPrevTo;
          counterMoves[cmIdx] = encodeMove(sm.fromRow, sm.fromCol, sm.toRow, sm.toCol);
        }
      }
      flag = TT_LOWERBOUND;
      break;
    }
  }

  // Store in TT
  if (!searchAborted) {
    ttStore(hash, depth, bestScore, flag, bestFromRow, bestFromCol, bestToRow, bestToCol);
  }

  return bestScore;
}

// ==================== Iterative Deepening ====================

export interface AIMove {
  from: Position;
  to: Position;
  score: number;
  searchDepth: number;
  nodesSearched?: number;
}

export type ProgressCallback = (depth: number, nodes: number, elapsed: number) => void;

export function getBestMove(board: Board, aiColor: PieceColor, difficulty: Difficulty, onProgress?: ProgressCallback, positionHashes?: number[], moveHistory?: { from: Position; to: Position }[]): AIMove | null {
  const maxDepth = DEPTH_MAP[difficulty];
  timeLimit = TIME_LIMIT[difficulty];
  startTime = Date.now();
  moveCounter++;

  // Set position history for repetition detection
  gamePositionHashes = positionHashes || [];

  // Opening book lookup within the search engine (backup for frontend lookup)
  if (moveHistory) {
    const bookMove = lookupOpeningBookInternal(moveHistory, aiColor);
    if (bookMove) {
      return { from: bookMove.from, to: bookMove.to, score: 0, searchDepth: 0, nodesSearched: 0 };
    }
  }

  let allMoves = getAllValidMovesFast(board, aiColor);
  if (allMoves.length === 0) return null;
  if (allMoves.length === 1) {
    return { from: allMoves[0].from, to: allMoves[0].to, score: 0, searchDepth: 1, nodesSearched: 1 };
  }

  // Opening move filter: in the first few moves, filter out obviously bad moves
  // to prevent the search engine from choosing non-standard openings.
  // This only applies when no opening book match was found.
  if (moveCounter <= 3) {
    const filtered = allMoves.filter(m => {
      const piece = board[m.from.row][m.from.col];
      if (!piece) return true;
      
      // Filter out aimless cannon forward pushes (not to central files 3-5)
      if (piece.type === 'cannon') {
        const isForward = piece.color === 'red' 
          ? m.to.row < m.from.row  // Red cannon moving up
          : m.to.row > m.from.row; // Black cannon moving down
        const isSameCol = m.to.col === m.from.col;
        const isEdgeFile = m.to.col <= 1 || m.to.col >= 7;
        
        // Block: cannon pushes forward on the same column (not a lateral move)
        if (isForward && isSameCol && isEdgeFile) return false;
      }
      
      // Filter out edge horse moves (horse to col 0 or col 8)
      if (piece.type === 'horse') {
        if (m.to.col === 0 || m.to.col === 8) return false;
      }
      
      return true;
    });
    
    // Only use filtered list if it still has reasonable options
    if (filtered.length >= 3) {
      allMoves = filtered;
    }
  }

  // ==================== Mirror/Symmetry Optimization ====================
  // When the board is left-right symmetric AND there is no position history
  // that could make mirrored moves non-equivalent (due to repetition detection),
  // we only search one of each mirror pair at the root, halving root moves.
  // With position history, mirrored moves may lead to different hashes and
  // different repetition penalties, so we must search both.
  const hasHistory = gamePositionHashes.length > 0;
  const isSymmetric = !hasHistory && isBoardSymmetric(board);
  let uniqueMoves = allMoves;
  let mirrorMap: Map<string, string> | null = null; // maps mirror key -> canonical key
  
  if (isSymmetric) {
    mirrorMap = new Map();
    const seen = new Set<string>();
    const filtered: typeof allMoves = [];
    
    for (const m of allMoves) {
      const key = `${m.from.row},${m.from.col},${m.to.row},${m.to.col}`;
      const mc = 8 - m.from.col;
      const mtc = 8 - m.to.col;
      const mirrorKey = `${m.from.row},${mc},${m.to.row},${mtc}`;
      
      if (key === mirrorKey) {
        // Self-symmetric move (e.g., center column moves) — always include
        filtered.push(m);
        seen.add(key);
      } else if (!seen.has(mirrorKey)) {
        // First of the mirror pair — include this one
        filtered.push(m);
        seen.add(key);
        mirrorMap.set(mirrorKey, key); // map the mirror to this canonical
      }
      // else: mirror already seen, skip this move
    }
    uniqueMoves = filtered;
  }

  // Compute initial hash
  const rootHash = computeZobristHash(board, aiColor);

  // Age TT entries for better replacement
  ttAge++;

  // Age history scores (decay)
  for (let i = 0; i < historyScores.length; i++) {
    historyScores[i] = historyScores[i] >> 2;
  }

  // Reset killers
  killerFrom1.fill(-1);
  killerTo1.fill(-1);
  killerFrom2.fill(-1);
  killerTo2.fill(-1);

  let bestMove: AIMove | null = null;
  let completedDepth = 0;
  const nextTurn = aiColor === 'red' ? 'black' : 'red';

  // Track root move scores
  const rootMoveScores: Map<string, number> = new Map();

  // Iterative deepening with timing
  let prevDepthTime = 0;
  let totalNodesSearched = 0;
  for (let depth = 1; depth <= maxDepth; depth++) {
    searchAborted = false;
    nodesSearched = 0;
    searchPathHashes = [];
    prevMoveFrom = -1;
    prevMoveTo = -1;
    const depthStartTime = Date.now();

    // Aspiration window with gradual widening
    let alpha = -INF;
    let beta = INF;
    let aspirationDelta = 35;
    if (depth >= 4 && bestMove) {
      alpha = bestMove.score - aspirationDelta;
      beta = bestMove.score + aspirationDelta;
    }

    let aspirationFailed = true;
    while (aspirationFailed) {
      aspirationFailed = false;

      // Sort root moves using previous iteration's best move
      const ttBest = bestMove ? { fromRow: bestMove.from.row, fromCol: bestMove.from.col, toRow: bestMove.to.row, toCol: bestMove.to.col } : null;
      const scoredRootMoves = generateScoredMoves(board, uniqueMoves, 0, ttBest);

      let currentBest: AIMove | null = null;
      let currentBestScore = -INF;

      for (let i = 0; i < scoredRootMoves.length; i++) {
        const sm = scoredRootMoves[i];
        const piece = board[sm.fromRow][sm.fromCol]!;
        const captured = board[sm.toRow][sm.toCol];

        makeMoveInPlace(board, sm.fromRow, sm.fromCol, sm.toRow, sm.toCol);
        const newHash = updateHash(rootHash, sm.fromRow, sm.fromCol, sm.toRow, sm.toCol, piece, captured);

        searchPathHashes.push(newHash);
        prevMoveFrom = posIdx(sm.fromRow, sm.fromCol);
        prevMoveTo = posIdx(sm.toRow, sm.toCol);

        let score: number;

        // Penalize moves that directly repeat a position from game history
        const isDirectRepeat = gamePositionHashes.includes(newHash);
        if (isDirectRepeat) {
          score = -15;
        } else if (i === 0) {
          score = -pvs(board, depth - 1, -beta, -alpha, nextTurn, newHash, 1, true);
        } else {
          // PVS null window search at root
          score = -pvs(board, depth - 1, -alpha - 1, -alpha, nextTurn, newHash, 1, true);
          if (!searchAborted && score > alpha && score < beta) {
            score = -pvs(board, depth - 1, -beta, -alpha, nextTurn, newHash, 1, true);
          }
        }

        searchPathHashes.pop();
        prevMoveFrom = -1;
        prevMoveTo = -1;
        undoMoveInPlace(board, sm.fromRow, sm.fromCol, sm.toRow, sm.toCol, piece, captured);

        if (searchAborted) break;

        const key = `${sm.fromRow},${sm.fromCol},${sm.toRow},${sm.toCol}`;
        rootMoveScores.set(key, score);

        if (score > currentBestScore) {
          currentBestScore = score;
          currentBest = { from: { row: sm.fromRow, col: sm.fromCol }, to: { row: sm.toRow, col: sm.toCol }, score, searchDepth: depth };
          if (score > alpha) alpha = score;
        }
      }

      if (searchAborted) break;

      // Aspiration window failure handling with gradual widening
      if (depth >= 4 && bestMove && currentBest) {
        if (currentBest.score <= bestMove.score - aspirationDelta) {
          // Fail low - widen alpha
          aspirationDelta *= 2;
          alpha = bestMove.score - aspirationDelta;
          beta = INF; // Open up beta
          aspirationFailed = true;
          if (aspirationDelta > 500) {
            alpha = -INF;
            beta = INF;
            aspirationFailed = true; // One more try with full window
            aspirationDelta = INF; // Prevent further widening
          }
          continue;
        }
        if (currentBest.score >= bestMove.score + aspirationDelta) {
          // Fail high - widen beta
          aspirationDelta *= 2;
          alpha = -INF; // Open up alpha
          beta = bestMove.score + aspirationDelta;
          aspirationFailed = true;
          if (aspirationDelta > 500) {
            alpha = -INF;
            beta = INF;
            aspirationFailed = true;
            aspirationDelta = INF;
          }
          continue;
        }
      }

      if (!searchAborted && currentBest) {
        bestMove = currentBest;
        completedDepth = depth;
        
        // Mirror symmetry: propagate scores to mirror moves
        if (isSymmetric && mirrorMap) {
          mirrorMap.forEach((canonicalKey, mirrorKey) => {
            const canonicalScore = rootMoveScores.get(canonicalKey);
            if (canonicalScore !== undefined) {
              rootMoveScores.set(mirrorKey, canonicalScore);
            }
          });
        }
      }
    }

    if (searchAborted && !bestMove) break;
    
    totalNodesSearched += nodesSearched;

    // Report progress after each completed depth
    if (onProgress && completedDepth >= depth) {
      onProgress(completedDepth, totalNodesSearched, Date.now() - startTime);
    }

    // Adaptive time management
    const depthTime = Date.now() - depthStartTime;
    const elapsed = Date.now() - startTime;
    if (depth >= 4) {
      if (prevDepthTime > 0 && depthTime > 0) {
        const actualBF = depthTime / prevDepthTime;
        const estimatedNext = elapsed + depthTime * Math.min(actualBF, 4);
        if (estimatedNext > timeLimit * 0.85) break;
      } else {
        if (elapsed > timeLimit * 0.4) break;
      }
    }
    prevDepthTime = depthTime;
  }

  // All difficulty levels always pick the best move — no randomization
  // Difficulty is differentiated solely by search time limit

  if (bestMove) {
    bestMove.searchDepth = completedDepth;
    bestMove.nodesSearched = totalNodesSearched;
  }

  return bestMove;
}

// ==================== Move Context Description ====================

export function describeMoveContext(
  board: Board,
  from: Position,
  to: Position,
  aiColor: PieceColor
): string {
  const piece = board[from.row][from.col];
  if (!piece) return '';

  const captured = board[to.row][to.col];
  const opponentColor = aiColor === 'red' ? 'black' : 'red';

  const { newBoard } = makeMove(board, from, to);
  const givesCheck = isInCheck(newBoard, opponentColor);
  const givesCheckmate = isCheckmate(newBoard, opponentColor);

  const pieceNames: Record<string, string> = {
    general: '将/帅', advisor: '士/仕', elephant: '象/相', horse: '马/傌',
    chariot: '车/俥', cannon: '砲/炮', soldier: '卒/兵',
  };

  const colNames = ['一', '二', '三', '四', '五', '六', '七', '八', '九'];

  let description = `电脑移动了${pieceNames[piece.type]}，从第${9 - from.row}行${colNames[from.col]}列到第${9 - to.row}行${colNames[to.col]}列。`;

  if (captured) {
    description += ` 这步棋吃掉了对方的${pieceNames[captured.type]}。`;
  }

  if (givesCheckmate) {
    description += ` 这步棋将杀！`;
  } else if (givesCheck) {
    description += ` 这步棋将军！`;
  }

  let aiMaterial = 0;
  let opponentMaterial = 0;
  for (let r = 0; r <= 9; r++) {
    for (let c = 0; c <= 8; c++) {
      const p = board[r][c];
      if (p) {
        if (p.color === aiColor) aiMaterial += EVAL_PIECE_VALUES[p.type];
        else opponentMaterial += EVAL_PIECE_VALUES[p.type];
      }
    }
  }

  description += ` 当前子力对比：电脑${aiMaterial}分，玩家${opponentMaterial}分。`;

  return description;
}
