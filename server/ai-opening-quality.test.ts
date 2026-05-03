import { describe, it, expect, beforeEach } from 'vitest';
import { getBestMove, resetSearchState, resetMoveCounter } from "../client/src/lib/ai";
import { createInitialBoard, makeMove, PIECE_CHARS } from "../client/src/lib/xiangqi";

describe("AI Opening Quality", () => {
  beforeEach(() => {
    resetSearchState();
  });

  it("search engine should choose a principled first move even without opening book", () => {
    // Test without moveHistory - pure search engine decision
    const board = createInitialBoard();
    const move = getBestMove(board, 'red', 'hard');
    
    const piece = board[move!.from.row][move!.from.col];
    console.log(`Red first move (no book): ${PIECE_CHARS[piece!.color][piece!.type]} (${move!.from.row},${move!.from.col})->(${move!.to.row},${move!.to.col}) score=${move!.score} depth=${move!.searchDepth}`);
    
    // Should NOT be an aimless cannon push forward
    const moveKey = `${move!.from.row},${move!.from.col}->${move!.to.row},${move!.to.col}`;
    const badOpenings = [
      '7,7->5,7', // cannon forward 2
      '7,7->4,7', // cannon forward 3
      '7,7->3,7', // cannon forward 4
      '7,1->5,1', // cannon forward 2
      '7,1->4,1', // cannon forward 3
      '7,1->3,1', // cannon forward 4
      '7,7->6,7', // small cannon push
      '7,1->6,1', // small cannon push
      '9,7->7,8', // edge horse
      '9,1->7,0', // edge horse
    ];
    
    expect(badOpenings).not.toContain(moveKey);
  });

  it("search engine should choose reasonable black response without opening book", () => {
    const board = createInitialBoard();
    const { newBoard } = makeMove(board, { row: 7, col: 7 }, { row: 7, col: 4 });
    
    resetSearchState();
    const move = getBestMove(newBoard, 'black', 'hard');
    
    const piece = newBoard[move!.from.row][move!.from.col];
    console.log(`Black response to zhongpao (no book): ${PIECE_CHARS[piece!.color][piece!.type]} (${move!.from.row},${move!.from.col})->(${move!.to.row},${move!.to.col}) score=${move!.score} depth=${move!.searchDepth}`);
    
    const moveKey = `${move!.from.row},${move!.from.col}->${move!.to.row},${move!.to.col}`;
    const goodResponses = [
      '0,1->2,2', '0,7->2,6', // horses (pingfengma)
      '2,1->2,4', '2,7->2,4', // central cannons
      '2,1->2,5', '2,7->2,3', // guogong cannons
      '2,1->2,3', '2,7->2,5', // shijiao cannons
      '2,1->2,2', '2,7->2,6', // zudipao (cannon to 3rd file)
      '2,1->2,6', '2,7->2,2', // cannon lateral moves
      '0,6->2,4', '0,2->2,4', // elephants
      '3,2->4,2', '3,6->4,6', // soldiers
      '0,3->1,4', '0,5->1,4', // advisors
    ];
    
    expect(goodResponses).toContain(moveKey);
  });

  it("with opening book, red should always choose a standard opening", () => {
    const board = createInitialBoard();
    const move = getBestMove(board, 'red', 'hard', undefined, undefined, []);
    
    const piece = board[move!.from.row][move!.from.col];
    console.log(`Red first move (with book): ${PIECE_CHARS[piece!.color][piece!.type]} (${move!.from.row},${move!.from.col})->(${move!.to.row},${move!.to.col}) score=${move!.score} depth=${move!.searchDepth}`);
    
    expect(move!.searchDepth).toBe(0);
    
    const moveKey = `${move!.from.row},${move!.from.col}->${move!.to.row},${move!.to.col}`;
    const standardOpenings = [
      '7,7->7,4', '7,1->7,4', // zhongpao
      '9,6->7,4', '9,2->7,4', // feixiang
      '6,2->5,2', '6,6->5,6', // xianrenzhilu
      '9,7->7,6', '9,1->7,2', // qima
      '7,7->7,3', '7,1->7,5', // guogongpao
    ];
    expect(standardOpenings).toContain(moveKey);
  });
});
