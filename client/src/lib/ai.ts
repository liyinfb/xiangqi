// AI Engine for Chinese Chess using Minimax with Alpha-Beta Pruning

import {
  Board,
  PieceColor,
  Position,
  PIECE_VALUES,
  POSITION_BONUS,
  getAllValidMoves,
  cloneBoard,
  isCheckmate,
  isInCheck,
  makeMove,
} from './xiangqi';

export type Difficulty = 'easy' | 'medium' | 'hard';

const DEPTH_MAP: Record<Difficulty, number> = {
  easy: 2,
  medium: 3,
  hard: 4,
};

// Evaluate the board from the perspective of the given color
function evaluateBoard(board: Board, color: PieceColor): number {
  let score = 0;
  const opponentColor = color === 'red' ? 'black' : 'red';

  for (let row = 0; row <= 9; row++) {
    for (let col = 0; col <= 8; col++) {
      const piece = board[row][col];
      if (!piece) continue;

      const baseValue = PIECE_VALUES[piece.type];
      const posBonus = POSITION_BONUS[piece.type];

      // For black pieces, flip the position bonus vertically
      let bonus = 0;
      if (piece.color === 'black') {
        bonus = posBonus[9 - row][col];
      } else {
        bonus = posBonus[row][col];
      }

      if (piece.color === color) {
        score += baseValue + bonus;
      } else {
        score -= baseValue + bonus;
      }
    }
  }

  // Bonus for checking opponent
  if (isInCheck(board, opponentColor)) {
    score += 30;
  }

  // Penalty for being in check
  if (isInCheck(board, color)) {
    score -= 30;
  }

  return score;
}

function minimax(
  board: Board,
  depth: number,
  alpha: number,
  beta: number,
  isMaximizing: boolean,
  aiColor: PieceColor,
  currentTurn: PieceColor
): number {
  if (depth === 0) {
    return evaluateBoard(board, aiColor);
  }

  if (isCheckmate(board, currentTurn)) {
    if (currentTurn === aiColor) {
      return -100000 + (DEPTH_MAP.hard - depth) * 100; // Prefer later checkmates (give opponent more time)
    } else {
      return 100000 - (DEPTH_MAP.hard - depth) * 100; // Prefer earlier checkmates
    }
  }

  const moves = getAllValidMoves(board, currentTurn);
  const nextTurn = currentTurn === 'red' ? 'black' : 'red';

  if (isMaximizing) {
    let maxEval = -Infinity;
    for (const move of moves) {
      const { newBoard } = makeMove(board, move.from, move.to);
      const evalScore = minimax(newBoard, depth - 1, alpha, beta, false, aiColor, nextTurn);
      maxEval = Math.max(maxEval, evalScore);
      alpha = Math.max(alpha, evalScore);
      if (beta <= alpha) break;
    }
    return maxEval;
  } else {
    let minEval = Infinity;
    for (const move of moves) {
      const { newBoard } = makeMove(board, move.from, move.to);
      const evalScore = minimax(newBoard, depth - 1, alpha, beta, true, aiColor, nextTurn);
      minEval = Math.min(minEval, evalScore);
      beta = Math.min(beta, evalScore);
      if (beta <= alpha) break;
    }
    return minEval;
  }
}

// Order moves for better pruning (captures first, then checks)
function orderMoves(board: Board, moves: { from: Position; to: Position }[]): { from: Position; to: Position }[] {
  return moves.sort((a, b) => {
    const captureA = board[a.to.row][a.to.col];
    const captureB = board[b.to.row][b.to.col];
    const scoreA = captureA ? PIECE_VALUES[captureA.type] : 0;
    const scoreB = captureB ? PIECE_VALUES[captureB.type] : 0;
    return scoreB - scoreA;
  });
}

export interface AIMove {
  from: Position;
  to: Position;
  score: number;
}

export function getBestMove(board: Board, aiColor: PieceColor, difficulty: Difficulty): AIMove | null {
  const depth = DEPTH_MAP[difficulty];
  let allMoves = getAllValidMoves(board, aiColor);

  if (allMoves.length === 0) return null;

  // Order moves for better pruning
  allMoves = orderMoves(board, allMoves);

  let bestMove: AIMove | null = null;
  let bestScore = -Infinity;

  const nextTurn = aiColor === 'red' ? 'black' : 'red';

  for (const move of allMoves) {
    const { newBoard } = makeMove(board, move.from, move.to);
    const score = minimax(newBoard, depth - 1, -Infinity, Infinity, false, aiColor, nextTurn);

    if (score > bestScore) {
      bestScore = score;
      bestMove = { from: move.from, to: move.to, score };
    }
  }

  // For easy difficulty, sometimes pick a suboptimal move
  if (difficulty === 'easy' && Math.random() < 0.3) {
    const scoredMoves: AIMove[] = allMoves.map(move => {
      const { newBoard } = makeMove(board, move.from, move.to);
      const score = minimax(newBoard, 1, -Infinity, Infinity, false, aiColor, nextTurn);
      return { ...move, score };
    });
    scoredMoves.sort((a, b) => b.score - a.score);
    // Pick from top 5 moves randomly
    const topMoves = scoredMoves.slice(0, Math.min(5, scoredMoves.length));
    return topMoves[Math.floor(Math.random() * topMoves.length)];
  }

  return bestMove;
}

// Generate a description of the AI's move for the LLM to explain
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
    general: 'General/King',
    advisor: 'Advisor',
    elephant: 'Elephant/Bishop',
    horse: 'Horse/Knight',
    chariot: 'Chariot/Rook',
    cannon: 'Cannon',
    soldier: 'Soldier/Pawn',
  };

  let description = `The AI (playing ${aiColor}) moved its ${pieceNames[piece.type]} from position (row ${from.row}, col ${from.col}) to (row ${to.row}, col ${to.col}).`;

  if (captured) {
    description += ` This move captured the opponent's ${pieceNames[captured.type]}.`;
  }

  if (givesCheckmate) {
    description += ` This move delivers checkmate!`;
  } else if (givesCheck) {
    description += ` This move puts the opponent's General in check.`;
  }

  // Count material
  let aiMaterial = 0;
  let opponentMaterial = 0;
  for (let r = 0; r <= 9; r++) {
    for (let c = 0; c <= 8; c++) {
      const p = board[r][c];
      if (p) {
        if (p.color === aiColor) aiMaterial += PIECE_VALUES[p.type];
        else opponentMaterial += PIECE_VALUES[p.type];
      }
    }
  }

  description += ` Current material balance: AI has ${aiMaterial} points, opponent has ${opponentMaterial} points.`;

  return description;
}
