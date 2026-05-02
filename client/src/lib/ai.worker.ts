// Web Worker for AI computation - runs in a separate thread to avoid blocking UI

import { getBestMove, Difficulty, AIMove, resetMoveCounter, ProgressCallback } from './ai';
import { Board, PieceColor } from './xiangqi';

export interface AIWorkerRequest {
  board: Board;
  aiColor: PieceColor;
  difficulty: Difficulty;
  positionHashes?: number[];
}

export interface AIWorkerResponse {
  move: AIMove | null;
  timeMs: number;
}

export interface AIWorkerProgress {
  type: 'progress';
  depth: number;
  nodes: number;
  elapsed: number;
  requestId?: number;
}

self.onmessage = (e: MessageEvent<AIWorkerRequest & { requestId?: number; moveNumber?: number; isNewGame?: boolean }>) => {
  const { board, aiColor, difficulty, requestId, isNewGame, positionHashes } = e.data;
  const start = Date.now();
  
  // Reset move counter if this is a new game
  if (isNewGame) {
    resetMoveCounter();
  }
  
  // Progress callback sends real-time updates back to main thread
  const onProgress: ProgressCallback = (depth, nodes, elapsed) => {
    self.postMessage({
      type: 'progress',
      depth,
      nodes,
      elapsed,
      requestId,
    });
  };
  
  const move = getBestMove(board, aiColor, difficulty, onProgress, positionHashes);
  
  const response = {
    type: 'result',
    move,
    timeMs: Date.now() - start,
    requestId,
  };
  
  self.postMessage(response);
};
