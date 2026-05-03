import { describe, it, expect, beforeEach } from 'vitest';
import { getBestMove, resetSearchState, resetMoveCounter } from "../client/src/lib/ai";
import { createInitialBoard, makeMove, Position } from "../client/src/lib/xiangqi";

describe("Opening Book Integration in Search Engine", () => {
  beforeEach(() => {
    resetSearchState();
  });

  it("should use opening book when moveHistory is provided for red first move", () => {
    const board = createInitialBoard();
    // Empty move history = red's first move
    const move = getBestMove(board, 'red', 'hard', undefined, undefined, []);
    
    console.log(`Red first move with opening book: (${move!.from.row},${move!.from.col})->(${move!.to.row},${move!.to.col}) score=${move!.score} depth=${move!.searchDepth}`);
    
    // Should be one of the standard opening moves from the book
    const moveKey = `${move!.from.row},${move!.from.col}->${move!.to.row},${move!.to.col}`;
    const standardOpenings = [
      '7,7->7,4', // 中炮 (炮二平五)
      '7,1->7,4', // 中炮 (炮八平五)
      '9,6->7,4', // 飞相 (相三进五)
      '6,2->5,2', // 仙人指路 (兵七进一)
      '9,7->7,6', // 起马 (马二进三)
      '7,7->7,3', // 过宫炮 (炮二平六)
      '9,2->7,4', // 飞相 mirror
      '6,6->5,6', // 仙人指路 mirror
      '9,1->7,2', // 起马 mirror
      '7,1->7,5', // 过宫炮 mirror
    ];
    
    expect(standardOpenings).toContain(moveKey);
    // Opening book moves have searchDepth 0 (no search needed)
    expect(move!.searchDepth).toBe(0);
  });

  it("should use opening book for black response to 中炮", () => {
    const board = createInitialBoard();
    // Red played 中炮: (7,7)->(7,4)
    const moveHistory = [{ from: { row: 7, col: 7 }, to: { row: 7, col: 4 } }];
    const { newBoard } = makeMove(board, { row: 7, col: 7 }, { row: 7, col: 4 });
    
    const move = getBestMove(newBoard, 'black', 'hard', undefined, undefined, moveHistory);
    
    console.log(`Black response to 中炮: (${move!.from.row},${move!.from.col})->(${move!.to.row},${move!.to.col}) score=${move!.score} depth=${move!.searchDepth}`);
    
    // Should be a standard response from the book
    const moveKey = `${move!.from.row},${move!.from.col}->${move!.to.row},${move!.to.col}`;
    const standardResponses = [
      '0,1->2,2', // 屏风马 (马8进7)
      '0,7->2,6', // 屏风马 (马2进3)
      '2,1->2,4', // 顺炮 (砲8平5)
      '2,7->2,4', // 列炮 (砲2平5)
    ];
    
    expect(standardResponses).toContain(moveKey);
    expect(move!.searchDepth).toBe(0);
  });

  it("should use opening book for black response to non-standard 炮二进二", () => {
    const board = createInitialBoard();
    // Red played 炮二进二: (7,7)->(5,7)
    const moveHistory = [{ from: { row: 7, col: 7 }, to: { row: 5, col: 7 } }];
    const { newBoard } = makeMove(board, { row: 7, col: 7 }, { row: 5, col: 7 });
    
    const move = getBestMove(newBoard, 'black', 'hard', undefined, undefined, moveHistory);
    
    console.log(`Black response to 炮二进二: (${move!.from.row},${move!.from.col})->(${move!.to.row},${move!.to.col}) score=${move!.score} depth=${move!.searchDepth}`);
    
    // Should be a standard development move from the book
    const moveKey = `${move!.from.row},${move!.from.col}->${move!.to.row},${move!.to.col}`;
    const standardResponses = [
      '0,1->2,2', // 起马 (马8进7)
      '0,7->2,6', // 起马 (马2进3)
      '2,1->2,4', // 中炮 (砲八平五)
    ];
    
    expect(standardResponses).toContain(moveKey);
    expect(move!.searchDepth).toBe(0);
  });

  it("should fall back to search when moveHistory has no book match", () => {
    const board = createInitialBoard();
    // Red played some unusual move not in the book
    // 帥(9,4)->(8,4) - moving the general forward (very unusual)
    const moveHistory = [{ from: { row: 9, col: 4 }, to: { row: 8, col: 4 } }];
    const { newBoard } = makeMove(board, { row: 9, col: 4 }, { row: 8, col: 4 });
    
    const move = getBestMove(newBoard, 'black', 'hard', undefined, undefined, moveHistory);
    
    console.log(`Black response to unusual move: (${move!.from.row},${move!.from.col})->(${move!.to.row},${move!.to.col}) score=${move!.score} depth=${move!.searchDepth}`);
    
    // Should fall back to search (searchDepth > 0)
    expect(move!.searchDepth).toBeGreaterThan(0);
    // Should still be a reasonable move (not a blunder)
    expect(move).not.toBeNull();
  });

  it("should work without moveHistory (backward compatible)", () => {
    const board = createInitialBoard();
    // No moveHistory provided - should use search engine
    const move = getBestMove(board, 'red', 'hard');
    
    console.log(`Red first move without moveHistory: (${move!.from.row},${move!.from.col})->(${move!.to.row},${move!.to.col}) score=${move!.score} depth=${move!.searchDepth}`);
    
    // Should use search engine (searchDepth > 0)
    expect(move!.searchDepth).toBeGreaterThan(0);
    expect(move).not.toBeNull();
  });
});
