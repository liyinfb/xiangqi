// AI Engine for Chinese Chess - Maximum Performance
// Features: Zobrist Hashing, Transposition Table, Null Move Pruning,
// Principal Variation Search (PVS), Quiescence Search, Late Move Reduction,
// Killer Moves, History Heuristic, MVV-LVA, Aspiration Windows, Iterative Deepening
// All search uses IN-PLACE make/undo to avoid board cloning

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
  isCheckmate,
  isInCheck,
  isInCheckFastExport,
  makeMove,
} from './xiangqi';

export type Difficulty = 'easy' | 'medium' | 'hard';

// Depth settings
const DEPTH_MAP: Record<Difficulty, number> = {
  easy: 3,
  medium: 5,
  hard: 24,
};

// Futility pruning margins indexed by depth
const FUTILITY_MARGIN = [0, 200, 350, 500, 650, 800, 950];
// Razoring margin
const RAZOR_MARGIN = 600;

// Time limits per difficulty (ms)
const TIME_LIMIT: Record<Difficulty, number> = {
  easy: 500,
  medium: 3000,
  hard: 5000,
};

// Move counter for randomization
let moveCounter = 0;

export function resetMoveCounter(): void {
  moveCounter = 0;
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

function computeZobristHash(board: Board, turn: PieceColor): number {
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

// ==================== Transposition Table ====================

const TT_EXACT = 0;
const TT_LOWERBOUND = 1;
const TT_UPPERBOUND = 2;

interface TTEntry {
  hash: number;
  depth: number;
  score: number;
  flag: number;
  bestFromRow: number;
  bestFromCol: number;
  bestToRow: number;
  bestToCol: number;
}

const TT_SIZE = 1 << 20; // ~1M entries
const TT_MASK = TT_SIZE - 1;
const ttTable: (TTEntry | null)[] = new Array(TT_SIZE).fill(null);

function ttProbe(hash: number, depth: number, alpha: number, beta: number): { score: number; flag: number; bestMove: { fromRow: number; fromCol: number; toRow: number; toCol: number } | null } | null {
  const entry = ttTable[hash & TT_MASK];
  if (!entry || entry.hash !== hash) return null;

  const bestMove = entry.bestFromRow >= 0 ? {
    fromRow: entry.bestFromRow, fromCol: entry.bestFromCol,
    toRow: entry.bestToRow, toCol: entry.bestToCol
  } : null;

  if (entry.depth >= depth) {
    if (entry.flag === TT_EXACT) return { score: entry.score, flag: TT_EXACT, bestMove };
    if (entry.flag === TT_LOWERBOUND && entry.score >= beta) return { score: entry.score, flag: TT_LOWERBOUND, bestMove };
    if (entry.flag === TT_UPPERBOUND && entry.score <= alpha) return { score: entry.score, flag: TT_UPPERBOUND, bestMove };
  }

  return { score: 0, flag: -1, bestMove };
}

function ttStore(hash: number, depth: number, score: number, flag: number, fromRow: number, fromCol: number, toRow: number, toCol: number): void {
  const idx = hash & TT_MASK;
  const existing = ttTable[idx];
  if (!existing || existing.hash !== hash || existing.depth <= depth) {
    ttTable[idx] = { hash, depth, score, flag, bestFromRow: fromRow, bestFromCol: fromCol, bestToRow: toRow, bestToCol: toCol };
  }
}

function ttClear(): void {
  ttTable.fill(null);
}

// ==================== Enhanced Evaluation ====================

const EVAL_PIECE_VALUES: Record<PieceType, number> = {
  general: 100000, advisor: 200, elephant: 200, horse: 480, chariot: 1000, cannon: 510, soldier: 100,
};

const SOLDIER_CROSSED_VALUE = 220;

// Pre-computed position-piece tables
const EVAL_TABLE_RED: Record<PieceType, number[][]> = {} as any;
const EVAL_TABLE_BLACK: Record<PieceType, number[][]> = {} as any;

function initEvalTables() {
  const types: PieceType[] = ['general', 'advisor', 'elephant', 'horse', 'chariot', 'cannon', 'soldier'];
  for (const type of types) {
    EVAL_TABLE_RED[type] = Array(10).fill(null).map((_, row) =>
      Array(9).fill(null).map((_, col) => {
        let base = EVAL_PIECE_VALUES[type];
        if (type === 'soldier' && row <= 4) base = SOLDIER_CROSSED_VALUE;
        return base + POSITION_BONUS[type][row][col] * 5;
      })
    );
    EVAL_TABLE_BLACK[type] = Array(10).fill(null).map((_, row) =>
      Array(9).fill(null).map((_, col) => {
        let base = EVAL_PIECE_VALUES[type];
        if (type === 'soldier' && row >= 5) base = SOLDIER_CROSSED_VALUE;
        return base + POSITION_BONUS[type][9 - row][col] * 5;
      })
    );
  }
}
initEvalTables();

function evaluateBoard(board: Board, aiColor: PieceColor): number {
  let score = 0;
  for (let row = 0; row <= 9; row++) {
    for (let col = 0; col <= 8; col++) {
      const piece = board[row][col];
      if (!piece) continue;
      const value = piece.color === 'red'
        ? EVAL_TABLE_RED[piece.type][row][col]
        : EVAL_TABLE_BLACK[piece.type][row][col];
      if (piece.color === aiColor) score += value;
      else score -= value;
    }
  }
  return score;
}

function evaluateFull(board: Board, aiColor: PieceColor): number {
  // Pure material + position evaluation for speed in quiescence search
  // Check bonuses are handled by the main search (check extensions)
  return evaluateBoard(board, aiColor);
}

// ==================== Move Ordering ====================

const historyScores: Int32Array = new Int32Array(90 * 90);
const MAX_PLY = 64;
const killerFrom1: Int8Array = new Int8Array(MAX_PLY).fill(-1);
const killerTo1: Int8Array = new Int8Array(MAX_PLY).fill(-1);
const killerFrom2: Int8Array = new Int8Array(MAX_PLY).fill(-1);
const killerTo2: Int8Array = new Int8Array(MAX_PLY).fill(-1);

function posIdx(row: number, col: number): number {
  return row * 9 + col;
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

// Compact move representation for sorting (avoids object creation)
interface ScoredMove {
  fromRow: number;
  fromCol: number;
  toRow: number;
  toCol: number;
  score: number;
}

function generateScoredMoves(
  board: Board,
  moves: { from: Position; to: Position }[],
  ply: number,
  ttMove: { fromRow: number; fromCol: number; toRow: number; toCol: number } | null
): ScoredMove[] {
  const scored: ScoredMove[] = new Array(moves.length);
  for (let i = 0; i < moves.length; i++) {
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
        s = 1000000 + EVAL_PIECE_VALUES[captured.type] * 10 - EVAL_PIECE_VALUES[attacker.type];
      } else if (isKiller(fr, fc, tr, tc, ply)) {
        s = 900000;
      } else {
        s = historyScores[posIdx(fr, fc) * 90 + posIdx(tr, tc)];
      }
    }
    scored[i] = { fromRow: fr, fromCol: fc, toRow: tr, toCol: tc, score: s };
  }
  // Insertion sort
  for (let i = 1; i < scored.length; i++) {
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

// ==================== In-Place Make/Undo ====================

// Make a move in place, return captured piece for undo
function makeMoveInPlace(board: Board, fromRow: number, fromCol: number, toRow: number, toCol: number): Piece | null {
  const captured = board[toRow][toCol];
  board[toRow][toCol] = board[fromRow][fromCol];
  board[fromRow][fromCol] = null;
  return captured;
}

// Undo a move in place
function undoMoveInPlace(board: Board, fromRow: number, fromCol: number, toRow: number, toCol: number, piece: Piece, captured: Piece | null): void {
  board[fromRow][fromCol] = piece;
  board[toRow][toCol] = captured;
}

// ==================== Quiescence Search ====================

let searchAborted = false;
let nodesSearched = 0;
let startTime = 0;
let timeLimit = 0;

function quiescence(
  board: Board,
  alpha: number,
  beta: number,
  aiColor: PieceColor,
  currentTurn: PieceColor,
  hash: number,
  qDepth: number
): number {
  const standPat = evaluateFull(board, aiColor);

  if (qDepth <= 0) return standPat;

  const isMax = currentTurn === aiColor;

  if (isMax) {
    if (standPat >= beta) return beta;
    if (standPat > alpha) alpha = standPat;
  } else {
    if (standPat <= alpha) return alpha;
    if (standPat < beta) beta = standPat;
  }

  // Generate only captures using fast capture generator
  const captureMoves = getCaptureMovesFast(board, currentTurn);

  // Sort by victim value (MVV) - build simple array
  const captures: { fr: number; fc: number; tr: number; tc: number; vv: number }[] = [];
  for (const m of captureMoves) {
    const victim = board[m.to.row][m.to.col];
    if (victim) {
      captures.push({ fr: m.from.row, fc: m.from.col, tr: m.to.row, tc: m.to.col, vv: EVAL_PIECE_VALUES[victim.type] });
    }
  }
  captures.sort((a, b) => b.vv - a.vv);

  const DELTA = 200;
  const nextTurn = currentTurn === 'red' ? 'black' : 'red';

  for (const cap of captures) {
    // Delta pruning
    if (isMax && standPat + cap.vv + DELTA < alpha) continue;
    if (!isMax && standPat - cap.vv - DELTA > beta) continue;

    const piece = board[cap.fr][cap.fc]!;
    const captured = makeMoveInPlace(board, cap.fr, cap.fc, cap.tr, cap.tc);
    const newHash = updateHash(hash, cap.fr, cap.fc, cap.tr, cap.tc, piece, captured);

    const score = quiescence(board, alpha, beta, aiColor, nextTurn, newHash, qDepth - 1);

    undoMoveInPlace(board, cap.fr, cap.fc, cap.tr, cap.tc, piece, captured);

    if (isMax) {
      if (score >= beta) return beta;
      if (score > alpha) alpha = score;
    } else {
      if (score <= alpha) return alpha;
      if (score < beta) beta = score;
    }
  }

  return isMax ? alpha : beta;
}

// ==================== Principal Variation Search ====================

function pvs(
  board: Board,
  depth: number,
  alpha: number,
  beta: number,
  aiColor: PieceColor,
  currentTurn: PieceColor,
  hash: number,
  ply: number,
  nullMoveAllowed: boolean
): number {
  if (searchAborted) return 0;

  // Time check every 2048 nodes
  nodesSearched++;
  if ((nodesSearched & 2047) === 0) {
    if (Date.now() - startTime > timeLimit) {
      searchAborted = true;
      return 0;
    }
  }

  const isMax = currentTurn === aiColor;
  const inCheck = isInCheckFastExport(board, currentTurn);

  // Check extension
  if (inCheck) depth++;

  // Leaf node
  if (depth <= 0) {
    return quiescence(board, alpha, beta, aiColor, currentTurn, hash, 6);
  }

  // TT probe
  const ttResult = ttProbe(hash, depth, alpha, beta);
  if (ttResult && ttResult.flag >= 0) {
    return ttResult.score;
  }
  const ttMove = ttResult?.bestMove || null;

  // Razoring
  if (!inCheck && depth <= 3 && ply > 0) {
    const staticEval = evaluateBoard(board, aiColor);
    if (isMax && staticEval + RAZOR_MARGIN < alpha) {
      const qScore = quiescence(board, alpha, beta, aiColor, currentTurn, hash, 6);
      if (qScore < alpha) return qScore;
    }
    if (!isMax && staticEval - RAZOR_MARGIN > beta) {
      const qScore = quiescence(board, alpha, beta, aiColor, currentTurn, hash, 6);
      if (qScore > beta) return qScore;
    }
  }

  // Null Move Pruning (before move generation to save time on cutoffs)
  if (nullMoveAllowed && !inCheck && depth >= 3 && ply > 0) {
    // Quick material check - scan only major piece positions (chariot, cannon, horse)
    let hasMaterial = false;
    for (let r = 0; r <= 9; r++) {
      for (let c = 0; c <= 8; c++) {
        const p = board[r][c];
        if (p && p.color === currentTurn) {
          const t = p.type;
          if (t === 'chariot' || t === 'cannon' || t === 'horse') {
            hasMaterial = true; r = 10; break; // break both loops
          }
        }
      }
    }

    if (hasMaterial) {
      const R = depth >= 8 ? 4 : depth >= 6 ? 3 : 2;
      const nextTurn = currentTurn === 'red' ? 'black' : 'red';
      const nullHash = hash ^ ZOBRIST_TURN;

      const nullScore = pvs(board, depth - 1 - R, alpha, beta, aiColor, nextTurn, nullHash, ply + 1, false);

      if (searchAborted) return 0;
      if (isMax && nullScore >= beta) return beta;
      if (!isMax && nullScore <= alpha) return alpha;
    }
  }

  // Generate moves
  const allMoves = getAllValidMovesFast(board, currentTurn);
  if (allMoves.length === 0) {
    if (inCheck) return isMax ? -200000 + ply : 200000 - ply;
    return 0;
  }

  // Static eval for futility
  const staticEvalForFutility = (!inCheck && depth <= 6) ? evaluateBoard(board, aiColor) : 0;

  // Sort moves
  const scoredMoves = generateScoredMoves(board, allMoves, ply, ttMove);

  const nextTurn = currentTurn === 'red' ? 'black' : 'red';
  let bestScore = isMax ? -Infinity : Infinity;
  let bestFromRow = -1, bestFromCol = -1, bestToRow = -1, bestToCol = -1;
  let flag = isMax ? TT_UPPERBOUND : TT_LOWERBOUND;
  let movesSearched = 0;

  for (let i = 0; i < scoredMoves.length; i++) {
    const sm = scoredMoves[i];
    const piece = board[sm.fromRow][sm.fromCol]!;
    const captured = board[sm.toRow][sm.toCol];

    // Futility Pruning
    if (!inCheck && depth <= 6 && movesSearched > 0 && !captured) {
      const margin = FUTILITY_MARGIN[depth] || 950;
      if (isMax && staticEvalForFutility + margin < alpha) continue;
      if (!isMax && staticEvalForFutility - margin > beta) continue;
    }

    // Make move in place
    makeMoveInPlace(board, sm.fromRow, sm.fromCol, sm.toRow, sm.toCol);
    const newHash = updateHash(hash, sm.fromRow, sm.fromCol, sm.toRow, sm.toCol, piece, captured);

    let score: number;

    if (movesSearched === 0) {
      score = pvs(board, depth - 1, alpha, beta, aiColor, nextTurn, newHash, ply + 1, true);
    } else {
      // Late Move Reduction
      let reduction = 0;
      if (depth >= 3 && movesSearched >= 3 && !captured && !inCheck) {
        const newInCheck = isInCheckFastExport(board, nextTurn);
        if (!newInCheck) {
          reduction = Math.floor(Math.log(depth) * Math.log(movesSearched) * 0.5);
          reduction = Math.max(1, Math.min(reduction, depth - 2));
        }
      }

      // PVS null window
      if (isMax) {
        score = pvs(board, depth - 1 - reduction, alpha, alpha + 1, aiColor, nextTurn, newHash, ply + 1, true);
        if (!searchAborted && score > alpha && (score < beta || reduction > 0)) {
          score = pvs(board, depth - 1, alpha, beta, aiColor, nextTurn, newHash, ply + 1, true);
        }
      } else {
        score = pvs(board, depth - 1 - reduction, beta - 1, beta, aiColor, nextTurn, newHash, ply + 1, true);
        if (!searchAborted && score < beta && (score > alpha || reduction > 0)) {
          score = pvs(board, depth - 1, alpha, beta, aiColor, nextTurn, newHash, ply + 1, true);
        }
      }
    }

    // Undo move in place
    undoMoveInPlace(board, sm.fromRow, sm.fromCol, sm.toRow, sm.toCol, piece, captured);

    if (searchAborted) return 0;

    movesSearched++;

    if (isMax) {
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
        if (!captured) {
          addKiller(sm.fromRow, sm.fromCol, sm.toRow, sm.toCol, ply);
          historyScores[posIdx(sm.fromRow, sm.fromCol) * 90 + posIdx(sm.toRow, sm.toCol)] += depth * depth;
        }
        flag = TT_LOWERBOUND;
        bestScore = beta;
        bestFromRow = sm.fromRow; bestFromCol = sm.fromCol;
        bestToRow = sm.toRow; bestToCol = sm.toCol;
        break;
      }
    } else {
      if (score < bestScore) {
        bestScore = score;
        bestFromRow = sm.fromRow; bestFromCol = sm.fromCol;
        bestToRow = sm.toRow; bestToCol = sm.toCol;
      }
      if (score < beta) {
        beta = score;
        flag = TT_EXACT;
      }
      if (alpha >= beta) {
        if (!captured) {
          addKiller(sm.fromRow, sm.fromCol, sm.toRow, sm.toCol, ply);
          historyScores[posIdx(sm.fromRow, sm.fromCol) * 90 + posIdx(sm.toRow, sm.toCol)] += depth * depth;
        }
        flag = TT_UPPERBOUND;
        bestScore = alpha;
        bestFromRow = sm.fromRow; bestFromCol = sm.fromCol;
        bestToRow = sm.toRow; bestToCol = sm.toCol;
        break;
      }
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

export function getBestMove(board: Board, aiColor: PieceColor, difficulty: Difficulty, onProgress?: ProgressCallback): AIMove | null {
  const maxDepth = DEPTH_MAP[difficulty];
  timeLimit = TIME_LIMIT[difficulty];
  startTime = Date.now();
  moveCounter++;

  const allMoves = getAllValidMovesFast(board, aiColor);
  if (allMoves.length === 0) return null;
  if (allMoves.length === 1) {
    return { from: allMoves[0].from, to: allMoves[0].to, score: 0, searchDepth: 1 };
  }

  // Compute initial hash
  const rootHash = computeZobristHash(board, aiColor);

  // Age history scores
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

  // Track root move scores for randomization
  const rootMoveScores: Map<string, number> = new Map();

  // Iterative deepening with timing
  let prevDepthTime = 0;
  let depthStartTime = 0;
  let totalNodesSearched = 0;
  for (let depth = 1; depth <= maxDepth; depth++) {
    searchAborted = false;
    nodesSearched = 0;
    depthStartTime = Date.now();

    // Aspiration window
    let alpha = -Infinity;
    let beta = Infinity;
    if (depth >= 4 && bestMove) {
      alpha = bestMove.score - 50;
      beta = bestMove.score + 50;
    }

    // Sort root moves using previous iteration's best move
    const ttBest = bestMove ? { fromRow: bestMove.from.row, fromCol: bestMove.from.col, toRow: bestMove.to.row, toCol: bestMove.to.col } : null;
    const scoredRootMoves = generateScoredMoves(board, allMoves, 0, ttBest);

    let currentBest: AIMove | null = null;
    let currentBestScore = -Infinity;

    for (let i = 0; i < scoredRootMoves.length; i++) {
      const sm = scoredRootMoves[i];
      const piece = board[sm.fromRow][sm.fromCol]!;
      const captured = board[sm.toRow][sm.toCol];

      makeMoveInPlace(board, sm.fromRow, sm.fromCol, sm.toRow, sm.toCol);
      const newHash = updateHash(rootHash, sm.fromRow, sm.fromCol, sm.toRow, sm.toCol, piece, captured);

      let score: number;

      if (i === 0) {
        score = pvs(board, depth - 1, alpha, beta, aiColor, nextTurn, newHash, 1, true);
      } else {
        score = pvs(board, depth - 1, currentBestScore, currentBestScore + 1, aiColor, nextTurn, newHash, 1, true);
        if (!searchAborted && score > currentBestScore && score < beta) {
          score = pvs(board, depth - 1, alpha, beta, aiColor, nextTurn, newHash, 1, true);
        }
      }

      undoMoveInPlace(board, sm.fromRow, sm.fromCol, sm.toRow, sm.toCol, piece, captured);

      if (searchAborted) break;

      // Track score for randomization
      const key = `${sm.fromRow},${sm.fromCol},${sm.toRow},${sm.toCol}`;
      rootMoveScores.set(key, score);

      if (score > currentBestScore) {
        currentBestScore = score;
        currentBest = { from: { row: sm.fromRow, col: sm.fromCol }, to: { row: sm.toRow, col: sm.toCol }, score, searchDepth: depth };
        if (score > alpha) alpha = score;
      }
    }

    if (searchAborted) break;

    // Aspiration window failure: re-search with full window
    if (depth >= 4 && bestMove && currentBest &&
      (currentBest.score <= bestMove.score - 50 || currentBest.score >= bestMove.score + 50)) {
      searchAborted = false;
      nodesSearched = 0;
      let fullBest: AIMove | null = null;
      let fullBestScore = -Infinity;

      for (let i = 0; i < scoredRootMoves.length; i++) {
        const sm = scoredRootMoves[i];
        const piece = board[sm.fromRow][sm.fromCol]!;
        const captured = board[sm.toRow][sm.toCol];

        makeMoveInPlace(board, sm.fromRow, sm.fromCol, sm.toRow, sm.toCol);
        const newHash = updateHash(rootHash, sm.fromRow, sm.fromCol, sm.toRow, sm.toCol, piece, captured);

        let score: number;
        if (i === 0) {
          score = pvs(board, depth - 1, -Infinity, Infinity, aiColor, nextTurn, newHash, 1, true);
        } else {
          score = pvs(board, depth - 1, fullBestScore, fullBestScore + 1, aiColor, nextTurn, newHash, 1, true);
          if (!searchAborted && score > fullBestScore) {
            score = pvs(board, depth - 1, -Infinity, Infinity, aiColor, nextTurn, newHash, 1, true);
          }
        }

        undoMoveInPlace(board, sm.fromRow, sm.fromCol, sm.toRow, sm.toCol, piece, captured);

        if (searchAborted) break;

        const key = `${sm.fromRow},${sm.fromCol},${sm.toRow},${sm.toCol}`;
        rootMoveScores.set(key, score);

        if (score > fullBestScore) {
          fullBestScore = score;
          fullBest = { from: { row: sm.fromRow, col: sm.fromCol }, to: { row: sm.toRow, col: sm.toCol }, score, searchDepth: depth };
        }
      }

      if (!searchAborted && fullBest) {
        currentBest = fullBest;
      }
    }

    if (!searchAborted && currentBest) {
      bestMove = currentBest;
      completedDepth = depth;
    }
    totalNodesSearched += nodesSearched;

    // Report progress after each completed depth
    if (onProgress && !searchAborted) {
      onProgress(completedDepth, totalNodesSearched, Date.now() - startTime);
    }

    // Adaptive time management based on actual branching factor
    const depthTime = Date.now() - depthStartTime;
    const elapsed = Date.now() - startTime;
    if (depth >= 4) {
      // Estimate time for next depth based on ratio between this and previous depth
      if (prevDepthTime > 0 && depthTime > 0) {
        const actualBF = depthTime / prevDepthTime;
        const estimatedNext = elapsed + depthTime * Math.min(actualBF, 4);
        if (estimatedNext > timeLimit * 0.9) break;
      } else {
        // Fallback: use 40% threshold
        if (elapsed > timeLimit * 0.4) break;
      }
    }
    prevDepthTime = depthTime;
  }

  // For easy difficulty, sometimes pick a suboptimal move
  if (difficulty === 'easy' && bestMove && Math.random() < 0.35) {
    const scoredMoves: AIMove[] = allMoves.map(move => {
      const piece = board[move.from.row][move.from.col]!;
      const captured = makeMoveInPlace(board, move.from.row, move.from.col, move.to.row, move.to.col);
      const score = evaluateBoard(board, aiColor);
      undoMoveInPlace(board, move.from.row, move.from.col, move.to.row, move.to.col, piece, captured);
      return { ...move, score, searchDepth: 1 };
    });
    scoredMoves.sort((a, b) => b.score - a.score);
    const topMoves = scoredMoves.slice(0, Math.min(5, scoredMoves.length));
    return topMoves[Math.floor(Math.random() * topMoves.length)];
  }

  // Randomization in opening: pick among moves with similar scores (using tracked scores)
  if (bestMove && completedDepth >= 2 && rootMoveScores.size > 0) {
    const RANDOMIZE_THRESHOLD = moveCounter <= 6 ? 30 : 10;
    const bestScore = bestMove.score;

    const candidateMoves: AIMove[] = [];
    rootMoveScores.forEach((score, key) => {
      if (Math.abs(score - bestScore) <= RANDOMIZE_THRESHOLD) {
        const parts = key.split(',');
        const fr = parseInt(parts[0]), fc = parseInt(parts[1]), tr = parseInt(parts[2]), tc = parseInt(parts[3]);
        candidateMoves.push({ from: { row: fr, col: fc }, to: { row: tr, col: tc }, score, searchDepth: completedDepth });
      }
    });

    if (candidateMoves.length > 1) {
      const chosen = candidateMoves[Math.floor(Math.random() * candidateMoves.length)];
      return chosen;
    }
  }

  if (bestMove) {
    bestMove.searchDepth = completedDepth;
  }

  if (bestMove) bestMove.nodesSearched = totalNodesSearched;
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
