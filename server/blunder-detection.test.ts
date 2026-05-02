import { describe, expect, it } from "vitest";
import { getBestMove, Difficulty, resetMoveCounter } from "../client/src/lib/ai";
import { createInitialBoard, makeMove, Board, Piece, PieceColor, getAllValidMoves, isInCheck, PIECE_VALUES } from "../client/src/lib/xiangqi";

// Calculate material for a given color
function getMaterial(board: Board, color: PieceColor): number {
  let material = 0;
  const PIECE_VAL: Record<string, number> = {
    general: 100000, advisor: 200, elephant: 200, horse: 480, chariot: 1000, cannon: 510, soldier: 100,
  };
  for (let r = 0; r <= 9; r++) {
    for (let c = 0; c <= 8; c++) {
      const p = board[r][c];
      if (p && p.color === color) material += PIECE_VAL[p.type];
    }
  }
  return material;
}

// Check if a move is a blunder: moving a piece to a square where it can be captured
// and the piece value lost is significantly more than what was gained
function isBlunder(board: Board, from: { row: number; col: number }, to: { row: number; col: number }, color: PieceColor): { isBlunder: boolean; reason: string } {
  const piece = board[from.row][from.col];
  if (!piece) return { isBlunder: false, reason: '' };
  
  const PIECE_VAL: Record<string, number> = {
    general: 100000, advisor: 200, elephant: 200, horse: 480, chariot: 1000, cannon: 510, soldier: 100,
  };
  
  const captured = board[to.row][to.col];
  const capturedValue = captured ? PIECE_VAL[captured.type] : 0;
  const movedPieceValue = PIECE_VAL[piece.type];
  
  // After making the move, check if the moved piece can be captured
  const newBoard = board.map(r => [...r]) as Board;
  newBoard[to.row][to.col] = piece;
  newBoard[from.row][from.col] = null;
  
  const opponentColor = color === 'red' ? 'black' : 'red';
  const opponentMoves = getAllValidMoves(newBoard, opponentColor);
  
  const canBeCaptured = opponentMoves.some(m => m.to.row === to.row && m.to.col === to.col);
  
  if (canBeCaptured && movedPieceValue > capturedValue + 200) {
    // Check if the piece was already attacked before moving
    const wasAttackedBefore = getAllValidMoves(board, opponentColor).some(m => m.to.row === from.row && m.to.col === from.col);
    if (wasAttackedBefore) return { isBlunder: false, reason: '' };
    
    // Check if the move gives check (tactical sacrifice)
    if (isInCheck(newBoard, opponentColor)) return { isBlunder: false, reason: '' };
    
    // Check if after opponent recaptures, we have a strong follow-up
    // (e.g., discovered attack or checkmate threat)
    // Simple heuristic: if AI's score is very positive, it's likely a tactical sacrifice
    // We'll check this in the caller
    
    return { 
      isBlunder: true, 
      reason: `Moved ${piece.type}(${from.row},${from.col})->(${to.row},${to.col}) into capture. Value lost: ${movedPieceValue}, gained: ${capturedValue}` 
    };
  }
  
  return { isBlunder: false, reason: '' };
}

describe("AI Blunder Detection in Self-Play", () => {
  it("hard mode should not blunder in first 20 moves of a game", () => {
    let board = createInitialBoard();
    let currentTurn: PieceColor = 'red';
    const blunders: string[] = [];
    resetMoveCounter();
    
    for (let moveNum = 1; moveNum <= 20; moveNum++) {
      const move = getBestMove(board, currentTurn, 'hard');
      if (!move) break;
      
      // Check if this is a blunder
      const blunderCheck = isBlunder(board, move.from, move.to, currentTurn);
      if (blunderCheck.isBlunder && move.score < 100) {
        // Only count as blunder if AI doesn't think it's winning
        // A positive score with a "sacrifice" usually means tactical play
        blunders.push(`Move ${moveNum} (${currentTurn}): ${blunderCheck.reason} [AI score: ${move.score}, depth: ${move.searchDepth}]`);
      }
      
      const { newBoard } = makeMove(board, move.from, move.to);
      board = newBoard;
      currentTurn = currentTurn === 'red' ? 'black' : 'red';
    }
    
    if (blunders.length > 0) {
      console.log("=== BLUNDERS DETECTED ===");
      for (const b of blunders) console.log(`  ${b}`);
    } else {
      console.log("No blunders detected in 20 moves of hard-mode self-play");
    }
    
    expect(blunders.length).toBe(0);
  }, 120000);

  it("hard mode should not lose material advantage when ahead", () => {
    // Position where black is ahead by a chariot - should not give it back
    const board: Board = Array(10).fill(null).map(() => Array(9).fill(null));
    board[0][4] = { type: 'general', color: 'black' };
    board[0][3] = { type: 'advisor', color: 'black' };
    board[0][5] = { type: 'advisor', color: 'black' };
    board[9][4] = { type: 'general', color: 'red' };
    board[9][3] = { type: 'advisor', color: 'red' };
    board[9][5] = { type: 'advisor', color: 'red' };
    
    // Black has 2 chariots, Red has 1 chariot + 1 horse
    board[2][0] = { type: 'chariot', color: 'black' };
    board[2][8] = { type: 'chariot', color: 'black' };
    board[1][4] = { type: 'cannon', color: 'black' };
    board[7][0] = { type: 'chariot', color: 'red' };
    board[7][8] = { type: 'horse', color: 'red' };
    board[8][4] = { type: 'cannon', color: 'red' };
    
    const move = getBestMove(board, 'black', 'hard');
    expect(move).not.toBeNull();
    console.log(`Material advantage test: score=${move!.score}, depth=${move!.searchDepth}, move=(${move!.from.row},${move!.from.col})->(${move!.to.row},${move!.to.col})`);
    
    // Black is ahead by ~520 (chariot - horse), should maintain advantage
    expect(move!.score).toBeGreaterThan(200);
  }, 10000);

  it("hard mode should not move a piece to be captured for free in midgame", () => {
    // Realistic midgame: both sides have chariots, horses, cannons
    const board: Board = Array(10).fill(null).map(() => Array(9).fill(null));
    // Black pieces
    board[0][4] = { type: 'general', color: 'black' };
    board[0][3] = { type: 'advisor', color: 'black' };
    board[0][5] = { type: 'advisor', color: 'black' };
    board[1][3] = { type: 'elephant', color: 'black' };
    board[1][5] = { type: 'elephant', color: 'black' };
    board[2][0] = { type: 'chariot', color: 'black' };
    board[3][7] = { type: 'horse', color: 'black' };
    board[4][1] = { type: 'cannon', color: 'black' };
    board[4][4] = { type: 'soldier', color: 'black' };
    board[5][2] = { type: 'soldier', color: 'black' };
    
    // Red pieces
    board[9][4] = { type: 'general', color: 'red' };
    board[9][3] = { type: 'advisor', color: 'red' };
    board[9][5] = { type: 'advisor', color: 'red' };
    board[8][3] = { type: 'elephant', color: 'red' };
    board[8][5] = { type: 'elephant', color: 'red' };
    board[7][8] = { type: 'chariot', color: 'red' };
    board[6][1] = { type: 'horse', color: 'red' };
    board[5][7] = { type: 'cannon', color: 'red' };
    board[5][4] = { type: 'soldier', color: 'red' };
    board[4][6] = { type: 'soldier', color: 'red' };
    
    const move = getBestMove(board, 'black', 'hard');
    expect(move).not.toBeNull();
    
    const blunderCheck = isBlunder(board, move!.from, move!.to, 'black');
    console.log(`Midgame test: score=${move!.score}, depth=${move!.searchDepth}, move=(${move!.from.row},${move!.from.col})->(${move!.to.row},${move!.to.col})`);
    if (blunderCheck.isBlunder) {
      console.log(`  BLUNDER: ${blunderCheck.reason}`);
    }
    
    expect(blunderCheck.isBlunder).toBe(false);
    expect(move!.score).toBeGreaterThan(-300);
  }, 10000);
});
