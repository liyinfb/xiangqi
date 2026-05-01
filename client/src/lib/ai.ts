// AI Engine for Chinese Chess - Advanced with Iterative Deepening, Quiescence Search,
// Transposition Table, Killer Moves, History Heuristic, and enhanced evaluation

import {
  Board,
  PieceColor,
  PieceType,
  Position,
  Piece,
  PIECE_VALUES,
  POSITION_BONUS,
  getAllValidMoves,
  cloneBoard,
  isCheckmate,
  isInCheck,
  makeMove,
} from './xiangqi';

export type Difficulty = 'easy' | 'medium' | 'hard';

// Depth settings: hard mode uses iterative deepening up to depth 6+
const DEPTH_MAP: Record<Difficulty, number> = {
  easy: 2,
  medium: 4,
  hard: 6,
};

// Time limits per difficulty (ms)
const TIME_LIMIT: Record<Difficulty, number> = {
  easy: 500,
  medium: 2000,
  hard: 8000,
};

// ==================== Transposition Table ====================
type TTFlag = 'exact' | 'lowerbound' | 'upperbound';

interface TTEntry {
  depth: number;
  score: number;
  flag: TTFlag;
  bestMove?: { from: Position; to: Position };
}

class TranspositionTable {
  private table: Map<string, TTEntry> = new Map();
  private maxSize = 500000;

  private hashBoard(board: Board, turn: PieceColor): string {
    // Simple but effective hash using board state
    let hash = turn === 'red' ? 'r' : 'b';
    for (let row = 0; row <= 9; row++) {
      for (let col = 0; col <= 8; col++) {
        const p = board[row][col];
        if (p) {
          hash += `${row}${col}${p.type[0]}${p.color[0]}`;
        }
      }
    }
    return hash;
  }

  get(board: Board, turn: PieceColor): TTEntry | undefined {
    return this.table.get(this.hashBoard(board, turn));
  }

  set(board: Board, turn: PieceColor, entry: TTEntry): void {
    if (this.table.size >= this.maxSize) {
      // Evict oldest entries
      const keys = this.table.keys();
      for (let i = 0; i < this.maxSize / 4; i++) {
        const key = keys.next().value;
        if (key) this.table.delete(key);
      }
    }
    this.table.set(this.hashBoard(board, turn), entry);
  }

  clear(): void {
    this.table.clear();
  }
}

// ==================== Enhanced Evaluation ====================

// More granular piece values
const ENHANCED_PIECE_VALUES: Record<PieceType, number> = {
  general: 100000,
  advisor: 200,
  elephant: 200,
  horse: 480,
  chariot: 1000,
  cannon: 510,
  soldier: 100,
};

// Soldier value increases significantly after crossing the river
const SOLDIER_CROSSED_VALUE = 200;

function countMobility(board: Board, color: PieceColor): number {
  let mobility = 0;
  for (let row = 0; row <= 9; row++) {
    for (let col = 0; col <= 8; col++) {
      const piece = board[row][col];
      if (piece && piece.color === color) {
        // Count chariot and cannon mobility more heavily
        if (piece.type === 'chariot' || piece.type === 'cannon') {
          // Approximate mobility by checking open lines
          let openFiles = 0;
          for (let r = 0; r <= 9; r++) {
            if (r !== row && !board[r][col]) openFiles++;
          }
          for (let c = 0; c <= 8; c++) {
            if (c !== col && !board[row][c]) openFiles++;
          }
          mobility += openFiles;
        }
      }
    }
  }
  return mobility;
}

function evaluateKingSafety(board: Board, color: PieceColor): number {
  let safety = 0;
  const isRed = color === 'red';

  // Find the general
  for (let row = (isRed ? 7 : 0); row <= (isRed ? 9 : 2); row++) {
    for (let col = 3; col <= 5; col++) {
      const piece = board[row][col];
      if (piece && piece.type === 'general' && piece.color === color) {
        // Bonus for advisors near the general
        const advisorPositions = [
          [row - 1, col - 1], [row - 1, col + 1],
          [row + 1, col - 1], [row + 1, col + 1],
        ];
        for (const [ar, ac] of advisorPositions) {
          if (ar >= 0 && ar <= 9 && ac >= 0 && ac <= 8) {
            const adj = board[ar][ac];
            if (adj && adj.type === 'advisor' && adj.color === color) {
              safety += 30;
            }
          }
        }

        // Penalty if general is exposed on a file with enemy chariot
        const opponentColor = color === 'red' ? 'black' : 'red';
        for (let r = 0; r <= 9; r++) {
          if (r === row) continue;
          const p = board[r][col];
          if (p && p.color === opponentColor && p.type === 'chariot') {
            safety -= 50;
          }
        }
        return safety;
      }
    }
  }
  return safety;
}

function evaluateBoard(board: Board, color: PieceColor): number {
  let score = 0;
  const opponentColor = color === 'red' ? 'black' : 'red';

  for (let row = 0; row <= 9; row++) {
    for (let col = 0; col <= 8; col++) {
      const piece = board[row][col];
      if (!piece) continue;

      let baseValue = ENHANCED_PIECE_VALUES[piece.type];

      // Soldier value bonus after crossing river
      if (piece.type === 'soldier') {
        const crossed = piece.color === 'red' ? row <= 4 : row >= 5;
        if (crossed) baseValue = SOLDIER_CROSSED_VALUE;
      }

      const posBonus = POSITION_BONUS[piece.type];
      let bonus = 0;
      if (piece.color === 'black') {
        bonus = posBonus[9 - row][col] * 5; // Scale up position bonus
      } else {
        bonus = posBonus[row][col] * 5;
      }

      if (piece.color === color) {
        score += baseValue + bonus;
      } else {
        score -= baseValue + bonus;
      }
    }
  }

  // Mobility bonus (scaled down to not dominate)
  score += countMobility(board, color) * 2;
  score -= countMobility(board, opponentColor) * 2;

  // King safety
  score += evaluateKingSafety(board, color);
  score -= evaluateKingSafety(board, opponentColor);

  // Check bonus
  if (isInCheck(board, opponentColor)) {
    score += 50;
  }
  if (isInCheck(board, color)) {
    score -= 50;
  }

  return score;
}

// ==================== Move Ordering ====================

// History heuristic table
const historyTable: number[][] = Array(90).fill(null).map(() => Array(90).fill(0));

function posToIndex(pos: Position): number {
  return pos.row * 9 + pos.col;
}

// Killer moves (2 per depth)
const killerMoves: ({ from: Position; to: Position } | null)[][] = [];

function initKillers(maxDepth: number) {
  killerMoves.length = 0;
  for (let i = 0; i <= maxDepth; i++) {
    killerMoves.push([null, null]);
  }
}

function isKillerMove(move: { from: Position; to: Position }, depth: number): boolean {
  if (depth >= killerMoves.length) return false;
  const k = killerMoves[depth];
  return (k[0] !== null && k[0].from.row === move.from.row && k[0].from.col === move.from.col &&
    k[0].to.row === move.to.row && k[0].to.col === move.to.col) ||
    (k[1] !== null && k[1].from.row === move.from.row && k[1].from.col === move.from.col &&
      k[1].to.row === move.to.row && k[1].to.col === move.to.col);
}

function addKillerMove(move: { from: Position; to: Position }, depth: number) {
  if (depth >= killerMoves.length) return;
  const k = killerMoves[depth];
  if (k[0] === null || (k[0].from.row !== move.from.row || k[0].from.col !== move.from.col ||
    k[0].to.row !== move.to.row || k[0].to.col !== move.to.col)) {
    k[1] = k[0];
    k[0] = { from: { ...move.from }, to: { ...move.to } };
  }
}

function orderMoves(
  board: Board,
  moves: { from: Position; to: Position }[],
  depth: number,
  ttBestMove?: { from: Position; to: Position }
): { from: Position; to: Position }[] {
  return moves.sort((a, b) => {
    // TT best move first
    if (ttBestMove) {
      const aIsTT = a.from.row === ttBestMove.from.row && a.from.col === ttBestMove.from.col &&
        a.to.row === ttBestMove.to.row && a.to.col === ttBestMove.to.col;
      const bIsTT = b.from.row === ttBestMove.from.row && b.from.col === ttBestMove.from.col &&
        b.to.row === ttBestMove.to.row && b.to.col === ttBestMove.to.col;
      if (aIsTT) return -1;
      if (bIsTT) return 1;
    }

    // Captures scored by MVV-LVA (Most Valuable Victim - Least Valuable Attacker)
    const captureA = board[a.to.row][a.to.col];
    const captureB = board[b.to.row][b.to.col];
    const pieceA = board[a.from.row][a.from.col];
    const pieceB = board[b.from.row][b.from.col];

    const scoreA = captureA
      ? ENHANCED_PIECE_VALUES[captureA.type] * 10 - (pieceA ? ENHANCED_PIECE_VALUES[pieceA.type] : 0)
      : 0;
    const scoreB = captureB
      ? ENHANCED_PIECE_VALUES[captureB.type] * 10 - (pieceB ? ENHANCED_PIECE_VALUES[pieceB.type] : 0)
      : 0;

    if (scoreA !== scoreB) return scoreB - scoreA;

    // Killer moves
    const aIsKiller = isKillerMove(a, depth);
    const bIsKiller = isKillerMove(b, depth);
    if (aIsKiller && !bIsKiller) return -1;
    if (bIsKiller && !aIsKiller) return 1;

    // History heuristic
    const histA = historyTable[posToIndex(a.from)][posToIndex(a.to)];
    const histB = historyTable[posToIndex(b.from)][posToIndex(b.to)];
    return histB - histA;
  });
}

// ==================== Quiescence Search ====================

function quiescenceSearch(
  board: Board,
  alpha: number,
  beta: number,
  aiColor: PieceColor,
  currentTurn: PieceColor,
  maxQDepth: number
): number {
  const standPat = evaluateBoard(board, aiColor);

  if (maxQDepth <= 0) return standPat;

  if (currentTurn === aiColor) {
    if (standPat >= beta) return beta;
    if (standPat > alpha) alpha = standPat;
  } else {
    if (standPat <= alpha) return alpha;
    if (standPat < beta) beta = standPat;
  }

  // Only search captures
  const allMoves = getAllValidMoves(board, currentTurn);
  const captures = allMoves.filter(m => board[m.to.row][m.to.col] !== null);

  // Sort captures by MVV-LVA
  captures.sort((a, b) => {
    const victimA = board[a.to.row][a.to.col];
    const victimB = board[b.to.row][b.to.col];
    return (victimB ? ENHANCED_PIECE_VALUES[victimB.type] : 0) -
      (victimA ? ENHANCED_PIECE_VALUES[victimA.type] : 0);
  });

  const nextTurn = currentTurn === 'red' ? 'black' : 'red';
  const isMaximizing = currentTurn === aiColor;

  for (const move of captures) {
    const { newBoard } = makeMove(board, move.from, move.to);
    const score = quiescenceSearch(newBoard, alpha, beta, aiColor, nextTurn, maxQDepth - 1);

    if (isMaximizing) {
      if (score >= beta) return beta;
      if (score > alpha) alpha = score;
    } else {
      if (score <= alpha) return alpha;
      if (score < beta) beta = score;
    }
  }

  return isMaximizing ? alpha : beta;
}

// ==================== Negamax with Alpha-Beta ====================

let searchAborted = false;
let nodesSearched = 0;

function negamax(
  board: Board,
  depth: number,
  alpha: number,
  beta: number,
  aiColor: PieceColor,
  currentTurn: PieceColor,
  startTime: number,
  timeLimit: number,
  tt: TranspositionTable,
  ply: number
): number {
  if (searchAborted) return 0;

  // Time check every 1000 nodes
  nodesSearched++;
  if (nodesSearched % 1000 === 0) {
    if (Date.now() - startTime > timeLimit) {
      searchAborted = true;
      return 0;
    }
  }

  const isMaximizing = currentTurn === aiColor;
  const sign = isMaximizing ? 1 : -1;

  // Check TT
  const ttEntry = tt.get(board, currentTurn);
  if (ttEntry && ttEntry.depth >= depth) {
    if (ttEntry.flag === 'exact') return ttEntry.score;
    if (ttEntry.flag === 'lowerbound' && ttEntry.score > alpha) alpha = ttEntry.score;
    if (ttEntry.flag === 'upperbound' && ttEntry.score < beta) beta = ttEntry.score;
    if (alpha >= beta) return ttEntry.score;
  }

  // Terminal: checkmate
  if (isCheckmate(board, currentTurn)) {
    const mateScore = isMaximizing ? -200000 + ply : 200000 - ply;
    return mateScore;
  }

  // Leaf node: quiescence search
  if (depth <= 0) {
    return quiescenceSearch(board, alpha, beta, aiColor, currentTurn, 4);
  }

  const allMoves = getAllValidMoves(board, currentTurn);
  if (allMoves.length === 0) {
    // Stalemate - slight penalty for the side to move
    return isMaximizing ? -1000 : 1000;
  }

  // Move ordering with TT best move
  const orderedMoves = orderMoves(board, allMoves, ply, ttEntry?.bestMove);
  const nextTurn = currentTurn === 'red' ? 'black' : 'red';

  let bestScore = isMaximizing ? -Infinity : Infinity;
  let bestMove: { from: Position; to: Position } | undefined;
  let flag: TTFlag = isMaximizing ? 'upperbound' : 'lowerbound';

  for (let i = 0; i < orderedMoves.length; i++) {
    const move = orderedMoves[i];
    const { newBoard } = makeMove(board, move.from, move.to);

    // Late Move Reduction (LMR) for non-captures after first few moves
    let reduction = 0;
    if (depth >= 3 && i >= 4 && !board[move.to.row][move.to.col] && !isInCheck(newBoard, nextTurn)) {
      reduction = 1;
    }

    let score = negamax(newBoard, depth - 1 - reduction, alpha, beta, aiColor, nextTurn, startTime, timeLimit, tt, ply + 1);

    // Re-search with full depth if LMR found something interesting
    if (reduction > 0 && ((isMaximizing && score > alpha) || (!isMaximizing && score < beta))) {
      score = negamax(newBoard, depth - 1, alpha, beta, aiColor, nextTurn, startTime, timeLimit, tt, ply + 1);
    }

    if (searchAborted) return 0;

    if (isMaximizing) {
      if (score > bestScore) {
        bestScore = score;
        bestMove = move;
      }
      if (score > alpha) {
        alpha = score;
        flag = 'exact';
      }
      if (alpha >= beta) {
        // Beta cutoff - update killer and history
        if (!board[move.to.row][move.to.col]) {
          addKillerMove(move, ply);
          historyTable[posToIndex(move.from)][posToIndex(move.to)] += depth * depth;
        }
        flag = 'lowerbound';
        break;
      }
    } else {
      if (score < bestScore) {
        bestScore = score;
        bestMove = move;
      }
      if (score < beta) {
        beta = score;
        flag = 'exact';
      }
      if (alpha >= beta) {
        if (!board[move.to.row][move.to.col]) {
          addKillerMove(move, ply);
          historyTable[posToIndex(move.from)][posToIndex(move.to)] += depth * depth;
        }
        flag = 'upperbound';
        break;
      }
    }
  }

  // Store in TT
  if (!searchAborted) {
    tt.set(board, currentTurn, { depth, score: bestScore, flag, bestMove });
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
  const timeLimit = TIME_LIMIT[difficulty];
  const startTime = Date.now();

  let allMoves = getAllValidMoves(board, aiColor);
  if (allMoves.length === 0) return null;
  if (allMoves.length === 1) {
    return { from: allMoves[0].from, to: allMoves[0].to, score: 0, searchDepth: 1 };
  }

  const tt = new TranspositionTable();
  initKillers(maxDepth + 10);

  // Reset history table periodically (decay)
  for (let i = 0; i < 90; i++) {
    for (let j = 0; j < 90; j++) {
      historyTable[i][j] = Math.floor(historyTable[i][j] / 2);
    }
  }

  let bestMove: AIMove | null = null;
  let completedDepth = 0;

  // Iterative deepening
  for (let depth = 1; depth <= maxDepth; depth++) {
    searchAborted = false;
    nodesSearched = 0;

    const orderedMoves = orderMoves(board, [...allMoves], 0, bestMove ? { from: bestMove.from, to: bestMove.to } : undefined);
    const nextTurn = aiColor === 'red' ? 'black' : 'red';

    let currentBest: AIMove | null = null;
    let currentBestScore = -Infinity;

    // Aspiration window for depth >= 3
    let alpha = -Infinity;
    let beta = Infinity;
    if (depth >= 3 && bestMove) {
      alpha = bestMove.score - 100;
      beta = bestMove.score + 100;
    }

    let needReSearch = false;

    for (const move of orderedMoves) {
      const { newBoard } = makeMove(board, move.from, move.to);
      let score = negamax(newBoard, depth - 1, alpha, beta, aiColor, nextTurn, startTime, timeLimit, tt, 1);

      if (searchAborted) break;

      if (score > currentBestScore) {
        currentBestScore = score;
        currentBest = { from: move.from, to: move.to, score, searchDepth: depth };
      }
    }

    if (searchAborted) {
      // If we completed at least depth 1, use the best from last completed depth
      break;
    }

    // If aspiration window failed, re-search with full window
    if (depth >= 3 && bestMove && currentBest &&
      (currentBest.score <= alpha || currentBest.score >= beta)) {
      searchAborted = false;
      nodesSearched = 0;
      let fullBest: AIMove | null = null;
      let fullBestScore = -Infinity;

      for (const move of orderedMoves) {
        const { newBoard } = makeMove(board, move.from, move.to);
        const score = negamax(newBoard, depth - 1, -Infinity, Infinity, aiColor, nextTurn, startTime, timeLimit, tt, 1);

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

    // Time check between iterations
    if (Date.now() - startTime > timeLimit * 0.6) {
      break; // Not enough time for next iteration
    }
  }

  // For easy difficulty, sometimes pick a suboptimal move
  if (difficulty === 'easy' && bestMove && Math.random() < 0.35) {
    const nextTurn = aiColor === 'red' ? 'black' : 'red';
    const scoredMoves: AIMove[] = allMoves.map(move => {
      const { newBoard } = makeMove(board, move.from, move.to);
      const score = evaluateBoard(newBoard, aiColor);
      return { ...move, score, searchDepth: 1 };
    });
    scoredMoves.sort((a, b) => b.score - a.score);
    const topMoves = scoredMoves.slice(0, Math.min(5, scoredMoves.length));
    return topMoves[Math.floor(Math.random() * topMoves.length)];
  }

  // Update searchDepth to reflect actual completed depth
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

  // Check if the move puts opponent in check
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

  // Count material
  let aiMaterial = 0;
  let opponentMaterial = 0;
  for (let r = 0; r <= 9; r++) {
    for (let c = 0; c <= 8; c++) {
      const p = board[r][c];
      if (p) {
        if (p.color === aiColor) aiMaterial += ENHANCED_PIECE_VALUES[p.type];
        else opponentMaterial += ENHANCED_PIECE_VALUES[p.type];
      }
    }
  }

  description += ` 当前子力对比：电脑${aiMaterial}分，玩家${opponentMaterial}分。`;

  return description;
}
