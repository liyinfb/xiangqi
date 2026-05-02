// Web Worker for AI computation - runs in a separate thread to avoid blocking UI

import { getBestMove, Difficulty, AIMove, resetMoveCounter } from './ai';
import { Board, PieceColor } from './xiangqi';

export interface AIWorkerRequest {
  board: Board;
  aiColor: PieceColor;
  difficulty: Difficulty;
}

export interface AIWorkerResponse {
  move: AIMove | null;
  timeMs: number;
}

self.onmessage = (e: MessageEvent<AIWorkerRequest & { requestId?: number; moveNumber?: number; isNewGame?: boolean }>) => {
  const { board, aiColor, difficulty, requestId, moveNumber, isNewGame } = e.data;
  const start = Date.now();
  
  // Reset move counter if this is a new game
  if (isNewGame) {
    resetMoveCounter();
  }
  
  const move = getBestMove(board, aiColor, difficulty);
  
  const response = {
    move,
    timeMs: Date.now() - start,
    requestId,
  };
  
  self.postMessage(response);
};
