// AI Engine for Chinese Chess - High Performance
// Features: Zobrist Hashing, Transposition Table, Null Move Pruning,
// Principal Variation Search (PVS), Quiescence Search, Late Move Reduction,
// Killer Moves, History Heuristic, MVV-LVA, Aspiration Windows, Iterative Deepening

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
  hard: 20,
};

// Futility pruning margins indexed by depth
const FUTILITY_MARGIN = [0, 200, 350, 500, 650, 800];
// Razoring margin
const RAZOR_MARGIN = 600;

// Time limits per difficulty (ms)
const TIME_LIMIT: Record<Difficulty, number> = {
  easy: 500,
  medium: 3000,
  hard: 5000,
};

// Move counter for randomization (tracks how many moves have been made)
let moveCounter = 0;

export function resetMoveCounter(): void {
  moveCounter = 0;
}

// ==================== Zobrist Hashing ====================

// Pre-computed random numbers for Zobrist hashing
// 10 rows * 9 cols * 7 piece types * 2 colors = 1260 random values + 1 for turn
const ZOBRIST_TABLE: number[] = [];
const ZOBRIST_TURN: number = Math.floor(Math.random() * 2147483647);

// Initialize Zobrist table with deterministic pseudo-random numbers
function initZobrist() {
  // Use a seeded PRNG for deterministic behavior
  let seed = 1234567890;
  function nextRand(): number {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed;
  }
  
  // 10 * 9 * 14 (7 types * 2 colors) = 1260 entries
  for (let i = 0; i < 1260; i++) {
    ZOBRIST_TABLE.push(nextRand());
  }
}
initZobrist();

const PIECE_TYPE_INDEX: Record<PieceType, number> = {
  general: 0,
  advisor: 1,
  elephant: 2,
  horse: 3,
  chariot: 4,
  cannon: 5,
  soldier: 6,
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
function updateHash(
  hash: number,
  from: Position,
  to: Position,
  piece: Piece,
  captured: Piece | null,
  prevTurn: PieceColor
): number {
  // Remove piece from source
  hash ^= ZOBRIST_TABLE[zobristIndex(from.row, from.col, piece.type, piece.color)];
  // Remove captured piece if any
  if (captured) {
    hash ^= ZOBRIST_TABLE[zobristIndex(to.row, to.col, captured.type, captured.color)];
  }
  // Place piece at destination
  hash ^= ZOBRIST_TABLE[zobristIndex(to.row, to.col, piece.type, piece.color)];
  // Toggle turn
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

// Fixed-size transposition table using array for speed
const TT_SIZE = 1 << 20; // ~1M entries
const TT_MASK = TT_SIZE - 1;
const ttTable: (TTEntry | null)[] = new Array(TT_SIZE).fill(null);

function ttProbe(hash: number, depth: number, alpha: number, beta: number): { score: number; flag: number; bestMove: { from: Position; to: Position } | null } | null {
  const entry = ttTable[hash & TT_MASK];
  if (!entry || entry.hash !== hash) return null;
  
  const bestMove = entry.bestFromRow >= 0 ? {
    from: { row: entry.bestFromRow, col: entry.bestFromCol },
    to: { row: entry.bestToRow, col: entry.bestToCol }
  } : null;
  
  if (entry.depth >= depth) {
    if (entry.flag === TT_EXACT) return { score: entry.score, flag: TT_EXACT, bestMove };
    if (entry.flag === TT_LOWERBOUND && entry.score >= beta) return { score: entry.score, flag: TT_LOWERBOUND, bestMove };
    if (entry.flag === TT_UPPERBOUND && entry.score <= alpha) return { score: entry.score, flag: TT_UPPERBOUND, bestMove };
  }
  
  // Return best move even if depth is insufficient for score
  return { score: 0, flag: -1, bestMove };
}

function ttStore(hash: number, depth: number, score: number, flag: number, bestMove: { from: Position; to: Position } | null): void {
  const idx = hash & TT_MASK;
  const existing = ttTable[idx];
  
  // Replace if: empty, same position with deeper search, or different position
  if (!existing || existing.hash !== hash || existing.depth <= depth) {
    ttTable[idx] = {
      hash,
      depth,
      score,
      flag,
      bestFromRow: bestMove ? bestMove.from.row : -1,
      bestFromCol: bestMove ? bestMove.from.col : -1,
      bestToRow: bestMove ? bestMove.to.row : -1,
      bestToCol: bestMove ? bestMove.to.col : -1,
    };
  }
}

function ttClear(): void {
  ttTable.fill(null);
}

// ==================== Enhanced Evaluation ====================

// Optimized piece values (centipawn-like scale)
const EVAL_PIECE_VALUES: Record<PieceType, number> = {
  general: 100000,
  advisor: 200,
  elephant: 200,
  horse: 480,
  chariot: 1000,
  cannon: 510,
  soldier: 100,
};

const SOLDIER_CROSSED_VALUE = 220;

// Pre-computed position-piece tables (10x9 for each piece+color combo)
// These combine base value + position bonus for fast lookup
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

// Fast evaluation using pre-computed tables
function evaluateBoard(board: Board, aiColor: PieceColor): number {
  let score = 0;
  
  for (let row = 0; row <= 9; row++) {
    for (let col = 0; col <= 8; col++) {
      const piece = board[row][col];
      if (!piece) continue;
      
      const value = piece.color === 'red'
        ? EVAL_TABLE_RED[piece.type][row][col]
        : EVAL_TABLE_BLACK[piece.type][row][col];
      
      if (piece.color === aiColor) {
        score += value;
      } else {
        score -= value;
      }
    }
  }
  
  return score;
}

// Faster check detection for evaluation (only checks if general is attacked)
function evaluateFull(board: Board, aiColor: PieceColor, currentTurn: PieceColor): number {
  let score = evaluateBoard(board, aiColor);
  
  const opponentColor = aiColor === 'red' ? 'black' : 'red';
  
  // Check bonuses
  if (isInCheckFastExport(board, opponentColor)) {
    score += 40;
  }
  if (isInCheckFastExport(board, aiColor)) {
    score -= 40;
  }
  
  return score;
}

// ==================== Move Ordering ====================

// History heuristic: [from_index][to_index]
const historyScores: Int32Array = new Int32Array(90 * 90);

// Killer moves: 2 per ply
const MAX_PLY = 64;
const killerFrom1: Int8Array = new Int8Array(MAX_PLY).fill(-1);
const killerTo1: Int8Array = new Int8Array(MAX_PLY).fill(-1);
const killerFrom2: Int8Array = new Int8Array(MAX_PLY).fill(-1);
const killerTo2: Int8Array = new Int8Array(MAX_PLY).fill(-1);

function posIdx(pos: Position): number {
  return pos.row * 9 + pos.col;
}

function moveIdx(from: Position, to: Position): number {
  return posIdx(from) * 90 + posIdx(to);
}

function addKiller(from: Position, to: Position, ply: number): void {
  if (ply >= MAX_PLY) return;
  const fi = posIdx(from);
  const ti = posIdx(to);
  if (killerFrom1[ply] !== fi || killerTo1[ply] !== ti) {
    killerFrom2[ply] = killerFrom1[ply];
    killerTo2[ply] = killerTo1[ply];
    killerFrom1[ply] = fi;
    killerTo1[ply] = ti;
  }
}

function isKiller(from: Position, to: Position, ply: number): boolean {
  if (ply >= MAX_PLY) return false;
  const fi = posIdx(from);
  const ti = posIdx(to);
  return (killerFrom1[ply] === fi && killerTo1[ply] === ti) ||
    (killerFrom2[ply] === fi && killerTo2[ply] === ti);
}

// Score a move for ordering
function scoreMove(
  board: Board,
  move: { from: Position; to: Position },
  ply: number,
  ttMove: { from: Position; to: Position } | null
): number {
  // TT move gets highest priority
  if (ttMove && move.from.row === ttMove.from.row && move.from.col === ttMove.from.col &&
    move.to.row === ttMove.to.row && move.to.col === ttMove.to.col) {
    return 10000000;
  }
  
  const captured = board[move.to.row][move.to.col];
  if (captured) {
    // MVV-LVA: victim value * 10 - attacker value
    const attacker = board[move.from.row][move.from.col]!;
    return 1000000 + EVAL_PIECE_VALUES[captured.type] * 10 - EVAL_PIECE_VALUES[attacker.type];
  }
  
  // Killer moves
  if (isKiller(move.from, move.to, ply)) {
    return 900000;
  }
  
  // History heuristic
  return historyScores[moveIdx(move.from, move.to)];
}

function sortMoves(
  board: Board,
  moves: { from: Position; to: Position }[],
  ply: number,
  ttMove: { from: Position; to: Position } | null
): void {
  // Score all moves
  const scores = moves.map(m => scoreMove(board, m, ply, ttMove));
  
  // Insertion sort (fast for small arrays, cache-friendly)
  for (let i = 1; i < moves.length; i++) {
    const move = moves[i];
    const score = scores[i];
    let j = i - 1;
    while (j >= 0 && scores[j] < score) {
      moves[j + 1] = moves[j];
      scores[j + 1] = scores[j];
      j--;
    }
    moves[j + 1] = move;
    scores[j + 1] = score;
  }
}

// ==================== Quiescence Search ====================

function quiescence(
  board: Board,
  alpha: number,
  beta: number,
  aiColor: PieceColor,
  currentTurn: PieceColor,
  hash: number,
  qDepth: number
): number {
  const standPat = evaluateFull(board, aiColor, currentTurn);
  
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
  const captures: { from: Position; to: Position; victimValue: number }[] = [];
  
  for (const m of captureMoves) {
    const victim = board[m.to.row][m.to.col];
    if (victim) {
      captures.push({ ...m, victimValue: EVAL_PIECE_VALUES[victim.type] });
    }
  }
  
  // Sort captures by victim value (MVV)
  captures.sort((a, b) => b.victimValue - a.victimValue);
  
  // Delta pruning threshold
  const DELTA = 200;
  
  const nextTurn = currentTurn === 'red' ? 'black' : 'red';
  
  for (const cap of captures) {
    // Delta pruning: skip if capture can't possibly raise alpha
    if (isMax && standPat + cap.victimValue + DELTA < alpha) continue;
    if (!isMax && standPat - cap.victimValue - DELTA > beta) continue;
    
    const piece = board[cap.from.row][cap.from.col]!;
    const captured = board[cap.to.row][cap.to.col];
    const { newBoard } = makeMove(board, cap.from, cap.to);
    const newHash = updateHash(hash, cap.from, cap.to, piece, captured, currentTurn);
    
    const score = quiescence(newBoard, alpha, beta, aiColor, nextTurn, newHash, qDepth - 1);
    
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

let searchAborted = false;
let nodesSearched = 0;
let startTime = 0;
let timeLimit = 0;

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
  
  // Time check every 1024 nodes for tighter time control
  nodesSearched++;
  if ((nodesSearched & 1023) === 0) {
    if (Date.now() - startTime > timeLimit) {
      searchAborted = true;
      return 0;
    }
  }
  
  const isMax = currentTurn === aiColor;
  const inCheck = isInCheckFastExport(board, currentTurn);
  
  // Check extension: extend search when in check
  if (inCheck) depth++;
  
  // Leaf node
  if (depth <= 0) {
    return quiescence(board, alpha, beta, aiColor, currentTurn, hash, 8);
  }
  
  // TT probe
  const ttResult = ttProbe(hash, depth, alpha, beta);
  if (ttResult && ttResult.flag >= 0) {
    return ttResult.score;
  }
  const ttMove = ttResult?.bestMove || null;
  
  // Razoring: if static eval is far below alpha at low depth, drop to qsearch
  if (!inCheck && depth <= 3 && ply > 0) {
    const staticEval = evaluateBoard(board, aiColor);
    if (isMax && staticEval + RAZOR_MARGIN < alpha) {
      const qScore = quiescence(board, alpha, beta, aiColor, currentTurn, hash, 8);
      if (qScore < alpha) return qScore;
    }
    if (!isMax && staticEval - RAZOR_MARGIN > beta) {
      const qScore = quiescence(board, alpha, beta, aiColor, currentTurn, hash, 8);
      if (qScore > beta) return qScore;
    }
  }
  
  // Checkmate detection
  const allMoves = getAllValidMovesFast(board, currentTurn);
  if (allMoves.length === 0) {
    if (inCheck) {
      // Checkmate
      return isMax ? -200000 + ply : 200000 - ply;
    }
    // Stalemate
    return 0;
  }
  
  // Null Move Pruning (only when not in check, and we have non-pawn material)
  if (nullMoveAllowed && !inCheck && depth >= 3 && ply > 0) {
    // Count non-pawn material for the side to move
    let hasMaterial = false;
    for (let r = 0; r <= 9; r++) {
      for (let c = 0; c <= 8; c++) {
        const p = board[r][c];
        if (p && p.color === currentTurn && p.type !== 'soldier' && p.type !== 'general') {
          hasMaterial = true;
          break;
        }
      }
      if (hasMaterial) break;
    }
    
    if (hasMaterial) {
      const R = depth >= 8 ? 4 : depth >= 6 ? 3 : 2; // More aggressive adaptive reduction
      const nextTurn = currentTurn === 'red' ? 'black' : 'red';
      const nullHash = hash ^ ZOBRIST_TURN;
      
      // Pass: just flip the turn
      const nullScore = pvs(board, depth - 1 - R, alpha, beta, aiColor, nextTurn, nullHash, ply + 1, false);
      
      if (searchAborted) return 0;
      
      if (isMax && nullScore >= beta) return beta;
      if (!isMax && nullScore <= alpha) return alpha;
    }
  }
  
  // Static eval for futility pruning
  const staticEvalForFutility = (!inCheck && depth <= 5) ? evaluateBoard(board, aiColor) : 0;
  
  // Sort moves
  sortMoves(board, allMoves, ply, ttMove);
  
  const nextTurn = currentTurn === 'red' ? 'black' : 'red';
  let bestScore = isMax ? -Infinity : Infinity;
  let bestMove: { from: Position; to: Position } | null = null;
  let flag = isMax ? TT_UPPERBOUND : TT_LOWERBOUND;
  let movesSearched = 0;
  
  for (let i = 0; i < allMoves.length; i++) {
    const move = allMoves[i];
    const piece = board[move.from.row][move.from.col]!;
    const captured = board[move.to.row][move.to.col];
    
    // Futility Pruning: skip quiet moves that can't possibly improve alpha/beta
    if (!inCheck && depth <= 5 && movesSearched > 0 && !captured) {
      const margin = FUTILITY_MARGIN[depth] || 800;
      if (isMax && staticEvalForFutility + margin < alpha) continue;
      if (!isMax && staticEvalForFutility - margin > beta) continue;
    }
    
    const { newBoard } = makeMove(board, move.from, move.to);
    const newHash = updateHash(hash, move.from, move.to, piece, captured, currentTurn);
    
    let score: number;
    
    if (movesSearched === 0) {
      // Full window search for first move (PV node)
      score = pvs(newBoard, depth - 1, alpha, beta, aiColor, nextTurn, newHash, ply + 1, true);
    } else {
      // Late Move Reduction - more aggressive
      let reduction = 0;
      if (depth >= 3 && movesSearched >= 3 && !captured && !inCheck) {
        const newInCheck = isInCheckFastExport(newBoard, nextTurn);
        if (!newInCheck) {
          // More aggressive LMR formula
          reduction = Math.floor(Math.log(depth) * Math.log(movesSearched) * 0.5);
          reduction = Math.max(1, Math.min(reduction, depth - 2));
        }
      }
      
      // Null window search (PVS)
      if (isMax) {
        score = pvs(newBoard, depth - 1 - reduction, alpha, alpha + 1, aiColor, nextTurn, newHash, ply + 1, true);
        // Re-search if it improved alpha
        if (score > alpha && (score < beta || reduction > 0)) {
          score = pvs(newBoard, depth - 1, alpha, beta, aiColor, nextTurn, newHash, ply + 1, true);
        }
      } else {
        score = pvs(newBoard, depth - 1 - reduction, beta - 1, beta, aiColor, nextTurn, newHash, ply + 1, true);
        // Re-search if it improved beta
        if (score < beta && (score > alpha || reduction > 0)) {
          score = pvs(newBoard, depth - 1, alpha, beta, aiColor, nextTurn, newHash, ply + 1, true);
        }
      }
    }
    
    if (searchAborted) return 0;
    
    movesSearched++;
    
    if (isMax) {
      if (score > bestScore) {
        bestScore = score;
        bestMove = move;
      }
      if (score > alpha) {
        alpha = score;
        flag = TT_EXACT;
      }
      if (alpha >= beta) {
        // Beta cutoff
        if (!captured) {
          addKiller(move.from, move.to, ply);
          historyScores[moveIdx(move.from, move.to)] += depth * depth;
        }
        flag = TT_LOWERBOUND;
        bestScore = beta;
        bestMove = move;
        break;
      }
    } else {
      if (score < bestScore) {
        bestScore = score;
        bestMove = move;
      }
      if (score < beta) {
        beta = score;
        flag = TT_EXACT;
      }
      if (alpha >= beta) {
        if (!captured) {
          addKiller(move.from, move.to, ply);
          historyScores[moveIdx(move.from, move.to)] += depth * depth;
        }
        flag = TT_UPPERBOUND;
        bestScore = alpha;
        bestMove = move;
        break;
      }
    }
  }
  
  // Store in TT
  if (!searchAborted) {
    ttStore(hash, depth, bestScore, flag, bestMove);
  }
  
  return bestScore;
}

// ==================== Iterative Deepening ====================

export interface AIMove {
  from: Position;
  to: Position;
  score: number;
  searchDepth: number;
}

export function getBestMove(board: Board, aiColor: PieceColor, difficulty: Difficulty): AIMove | null {
  const maxDepth = DEPTH_MAP[difficulty];
  timeLimit = TIME_LIMIT[difficulty];
  startTime = Date.now();
  moveCounter++;
  
  const allMoves = getAllValidMovesFast(board, aiColor);
  if (allMoves.length === 0) return null;
  if (allMoves.length === 1) {
    return { from: allMoves[0].from, to: allMoves[0].to, score: 0, searchDepth: 1 };
  }
  
  // Don't clear TT between moves - accumulated knowledge helps search deeper
  // Randomization is handled separately via move counter
  
  // Compute initial hash
  const rootHash = computeZobristHash(board, aiColor);
  
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
  
  // Iterative deepening
  for (let depth = 1; depth <= maxDepth; depth++) {
    searchAborted = false;
    nodesSearched = 0;
    
    // Aspiration window
    let alpha = -Infinity;
    let beta = Infinity;
    if (depth >= 4 && bestMove) {
      alpha = bestMove.score - 50;
      beta = bestMove.score + 50;
    }
    
    // Sort root moves using previous iteration's best move
    const rootMoves = [...allMoves];
    const ttBest = bestMove ? { from: bestMove.from, to: bestMove.to } : null;
    sortMoves(board, rootMoves, 0, ttBest);
    
    let currentBest: AIMove | null = null;
    let currentBestScore = -Infinity;
    let failedAspiration = false;
    
    for (let i = 0; i < rootMoves.length; i++) {
      const move = rootMoves[i];
      const piece = board[move.from.row][move.from.col]!;
      const captured = board[move.to.row][move.to.col];
      const { newBoard } = makeMove(board, move.from, move.to);
      const newHash = updateHash(rootHash, move.from, move.to, piece, captured, aiColor);
      
      let score: number;
      
      if (i === 0) {
        score = pvs(newBoard, depth - 1, alpha, beta, aiColor, nextTurn, newHash, 1, true);
      } else {
        // PVS: null window first
        score = pvs(newBoard, depth - 1, currentBestScore, currentBestScore + 1, aiColor, nextTurn, newHash, 1, true);
        if (!searchAborted && score > currentBestScore && score < beta) {
          score = pvs(newBoard, depth - 1, alpha, beta, aiColor, nextTurn, newHash, 1, true);
        }
      }
      
      if (searchAborted) break;
      
      if (score > currentBestScore) {
        currentBestScore = score;
        currentBest = { from: move.from, to: move.to, score, searchDepth: depth };
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
      
      for (let i = 0; i < rootMoves.length; i++) {
        const move = rootMoves[i];
        const piece = board[move.from.row][move.from.col]!;
        const captured = board[move.to.row][move.to.col];
        const { newBoard } = makeMove(board, move.from, move.to);
        const newHash = updateHash(rootHash, move.from, move.to, piece, captured, aiColor);
        
        let score: number;
        if (i === 0) {
          score = pvs(newBoard, depth - 1, -Infinity, Infinity, aiColor, nextTurn, newHash, 1, true);
        } else {
          score = pvs(newBoard, depth - 1, fullBestScore, fullBestScore + 1, aiColor, nextTurn, newHash, 1, true);
          if (!searchAborted && score > fullBestScore) {
            score = pvs(newBoard, depth - 1, -Infinity, Infinity, aiColor, nextTurn, newHash, 1, true);
          }
        }
        
        if (searchAborted) break;
        
        if (score > fullBestScore) {
          fullBestScore = score;
          fullBest = { from: move.from, to: move.to, score, searchDepth: depth };
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
    
    // Time management: don't start next iteration if >60% time used
    // (slightly more aggressive to squeeze one more depth level)
    if (Date.now() - startTime > timeLimit * 0.6) {
      break;
    }
  }
  
  // For easy difficulty, sometimes pick a suboptimal move
  if (difficulty === 'easy' && bestMove && Math.random() < 0.35) {
    const scoredMoves: AIMove[] = allMoves.map(move => {
      const { newBoard } = makeMove(board, move.from, move.to);
      const score = evaluateBoard(newBoard, aiColor);
      return { ...move, score, searchDepth: 1 };
    });
    scoredMoves.sort((a, b) => b.score - a.score);
    const topMoves = scoredMoves.slice(0, Math.min(5, scoredMoves.length));
    return topMoves[Math.floor(Math.random() * topMoves.length)];
  }
  
  // Add randomization: in the opening phase (first 6 moves), pick randomly
  // among moves with similar scores to add variety
  if (bestMove && completedDepth >= 2) {
    const RANDOMIZE_THRESHOLD = moveCounter <= 6 ? 30 : 10; // Wider margin in opening
    const bestScore = bestMove.score;
    
    // Collect all root moves and their scores from the last completed iteration
    const candidateMoves: AIMove[] = [];
    const rootMovesFinal = [...allMoves];
    const ttBestFinal = { from: bestMove.from, to: bestMove.to };
    sortMoves(board, rootMovesFinal, 0, ttBestFinal);
    
    for (const move of rootMovesFinal) {
      const piece = board[move.from.row][move.from.col]!;
      const captured = board[move.to.row][move.to.col];
      const { newBoard } = makeMove(board, move.from, move.to);
      const newHash = updateHash(rootHash, move.from, move.to, piece, captured, aiColor);
      
      // Quick shallow search to get approximate score
      searchAborted = false;
      nodesSearched = 0;
      const quickDepth = Math.min(completedDepth, 3);
      const score = pvs(newBoard, quickDepth - 1, -Infinity, Infinity, aiColor, nextTurn, newHash, 1, true);
      
      if (!searchAborted && Math.abs(score - bestScore) <= RANDOMIZE_THRESHOLD) {
        candidateMoves.push({ from: move.from, to: move.to, score, searchDepth: completedDepth });
      }
      
      // Don't spend too much time on randomization
      if (Date.now() - startTime > timeLimit * 0.95) break;
      if (candidateMoves.length >= 5) break;
    }
    
    if (candidateMoves.length > 1) {
      const chosen = candidateMoves[Math.floor(Math.random() * candidateMoves.length)];
      chosen.searchDepth = completedDepth;
      return chosen;
    }
  }
  
  if (bestMove) {
    bestMove.searchDepth = completedDepth;
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
    general: '将/帅',
    advisor: '士/仕',
    elephant: '象/相',
    horse: '马/傌',
    chariot: '车/俥',
    cannon: '砲/炮',
    soldier: '卒/兵',
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
