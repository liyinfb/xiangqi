import { describe, expect, it } from "vitest";
import {
  createInitialBoard,
  getValidMoves,
  isInCheck,
  isCheckmate,
  makeMove,
  getAllValidMoves,
  cloneBoard,
  Board,
} from "@/lib/xiangqi";

describe("createInitialBoard", () => {
  it("creates a 10x9 board", () => {
    const board = createInitialBoard();
    expect(board.length).toBe(10);
    board.forEach(row => expect(row.length).toBe(9));
  });

  it("places generals in correct positions", () => {
    const board = createInitialBoard();
    expect(board[0][4]).toEqual({ type: "general", color: "black" });
    expect(board[9][4]).toEqual({ type: "general", color: "red" });
  });

  it("places all red pieces correctly", () => {
    const board = createInitialBoard();
    // Chariots
    expect(board[9][0]).toEqual({ type: "chariot", color: "red" });
    expect(board[9][8]).toEqual({ type: "chariot", color: "red" });
    // Horses
    expect(board[9][1]).toEqual({ type: "horse", color: "red" });
    expect(board[9][7]).toEqual({ type: "horse", color: "red" });
    // Elephants
    expect(board[9][2]).toEqual({ type: "elephant", color: "red" });
    expect(board[9][6]).toEqual({ type: "elephant", color: "red" });
    // Advisors
    expect(board[9][3]).toEqual({ type: "advisor", color: "red" });
    expect(board[9][5]).toEqual({ type: "advisor", color: "red" });
    // Cannons
    expect(board[7][1]).toEqual({ type: "cannon", color: "red" });
    expect(board[7][7]).toEqual({ type: "cannon", color: "red" });
    // Soldiers
    expect(board[6][0]).toEqual({ type: "soldier", color: "red" });
    expect(board[6][2]).toEqual({ type: "soldier", color: "red" });
    expect(board[6][4]).toEqual({ type: "soldier", color: "red" });
    expect(board[6][6]).toEqual({ type: "soldier", color: "red" });
    expect(board[6][8]).toEqual({ type: "soldier", color: "red" });
  });

  it("places all black pieces correctly", () => {
    const board = createInitialBoard();
    // Chariots
    expect(board[0][0]).toEqual({ type: "chariot", color: "black" });
    expect(board[0][8]).toEqual({ type: "chariot", color: "black" });
    // Horses
    expect(board[0][1]).toEqual({ type: "horse", color: "black" });
    expect(board[0][7]).toEqual({ type: "horse", color: "black" });
    // Cannons
    expect(board[2][1]).toEqual({ type: "cannon", color: "black" });
    expect(board[2][7]).toEqual({ type: "cannon", color: "black" });
    // Soldiers
    expect(board[3][0]).toEqual({ type: "soldier", color: "black" });
    expect(board[3][4]).toEqual({ type: "soldier", color: "black" });
    expect(board[3][8]).toEqual({ type: "soldier", color: "black" });
  });
});

describe("getValidMoves", () => {
  it("returns valid moves for a chariot", () => {
    const board = createInitialBoard();
    // Red chariot at (9,0) - blocked by own pieces initially
    const moves = getValidMoves(board, { row: 9, col: 0 });
    // Can only move up along column 0 (rows 7, 8 are empty? No, row 7 col 0 is empty, row 8 col 0 is empty)
    // Actually row 8 col 0 is empty, row 7 col 0 is empty (cannon is at col 1)
    // Chariot can move to rows 8 and 7 (blocked by soldier at row 6)
    expect(moves.length).toBeGreaterThan(0);
    expect(moves.some(m => m.row === 8 && m.col === 0)).toBe(true);
  });

  it("returns valid moves for a horse", () => {
    const board = createInitialBoard();
    // Red horse at (9,1) - blocked by pieces at (8,0) and (8,2)? No, row 8 is empty
    // Horse at (9,1): blocking positions are (8,1) for up moves - row 8 col 1 is empty
    const moves = getValidMoves(board, { row: 9, col: 1 });
    // Horse can jump to (7,0) and (7,2) - but (7,0) is empty, (7,2) is empty
    // Blocking leg at (8,1) - empty, so can go to (7,0) and (7,2)
    expect(moves.length).toBeGreaterThan(0);
  });

  it("returns valid moves for a soldier before crossing river", () => {
    const board = createInitialBoard();
    // Red soldier at (6,0) - can only move forward (up)
    const moves = getValidMoves(board, { row: 6, col: 0 });
    expect(moves.length).toBe(1);
    expect(moves[0]).toEqual({ row: 5, col: 0 });
  });

  it("returns valid moves for a soldier after crossing river", () => {
    const board: Board = Array(10).fill(null).map(() => Array(9).fill(null));
    board[4][4] = { type: "soldier", color: "red" };
    board[9][3] = { type: "general", color: "red" };
    board[0][5] = { type: "general", color: "black" };

    const moves = getValidMoves(board, { row: 4, col: 4 });
    // Soldier at (4,4) crossed river, generals on different columns
    // Can move forward (3,4), left (4,3), right (4,5)
    expect(moves.length).toBe(3);
    expect(moves.some(m => m.row === 3 && m.col === 4)).toBe(true); // forward
    expect(moves.some(m => m.row === 4 && m.col === 3)).toBe(true); // left
    expect(moves.some(m => m.row === 4 && m.col === 5)).toBe(true); // right
  });

  it("general stays within palace", () => {
    const board: Board = Array(10).fill(null).map(() => Array(9).fill(null));
    board[9][4] = { type: "general", color: "red" };
    board[0][4] = { type: "general", color: "black" };

    const moves = getValidMoves(board, { row: 9, col: 4 });
    // General at (9,4) can move to (8,4), (9,3), (9,5) - all within palace
    // But (8,4) would face black general at (0,4) - flying general rule!
    moves.forEach(m => {
      expect(m.col).toBeGreaterThanOrEqual(3);
      expect(m.col).toBeLessThanOrEqual(5);
      expect(m.row).toBeGreaterThanOrEqual(7);
      expect(m.row).toBeLessThanOrEqual(9);
    });
  });

  it("advisor stays within palace", () => {
    const board: Board = Array(10).fill(null).map(() => Array(9).fill(null));
    board[9][4] = { type: "general", color: "red" };
    board[8][4] = { type: "advisor", color: "red" };
    board[0][4] = { type: "general", color: "black" };

    const moves = getValidMoves(board, { row: 8, col: 4 });
    moves.forEach(m => {
      expect(m.col).toBeGreaterThanOrEqual(3);
      expect(m.col).toBeLessThanOrEqual(5);
      expect(m.row).toBeGreaterThanOrEqual(7);
      expect(m.row).toBeLessThanOrEqual(9);
    });
  });

  it("elephant cannot cross river", () => {
    const board: Board = Array(10).fill(null).map(() => Array(9).fill(null));
    board[9][4] = { type: "general", color: "red" };
    board[5][2] = { type: "elephant", color: "red" };
    board[0][4] = { type: "general", color: "black" };

    const moves = getValidMoves(board, { row: 5, col: 2 });
    // Elephant at (5,2) - all moves must stay on own side (row >= 5)
    moves.forEach(m => {
      expect(m.row).toBeGreaterThanOrEqual(5);
    });
  });

  it("cannon captures by jumping over exactly one piece", () => {
    const board: Board = Array(10).fill(null).map(() => Array(9).fill(null));
    board[9][4] = { type: "general", color: "red" };
    board[0][3] = { type: "general", color: "black" };
    board[5][0] = { type: "cannon", color: "red" };
    board[3][0] = { type: "soldier", color: "red" }; // screen piece
    board[1][0] = { type: "soldier", color: "black" }; // target

    const moves = getValidMoves(board, { row: 5, col: 0 });
    // Cannon can capture black soldier at (1,0) by jumping over red soldier at (3,0)
    expect(moves.some(m => m.row === 1 && m.col === 0)).toBe(true);
  });
});

describe("isInCheck", () => {
  it("detects check from chariot", () => {
    const board: Board = Array(10).fill(null).map(() => Array(9).fill(null));
    board[9][4] = { type: "general", color: "red" };
    board[0][4] = { type: "general", color: "black" };
    board[9][0] = { type: "chariot", color: "black" }; // Attacking red general's row

    // Chariot at (9,0) attacks along row 9 - red general at (9,4) is in check
    expect(isInCheck(board, "red")).toBe(true);
  });

  it("detects no check in initial position", () => {
    const board = createInitialBoard();
    expect(isInCheck(board, "red")).toBe(false);
    expect(isInCheck(board, "black")).toBe(false);
  });
});

describe("isCheckmate", () => {
  it("detects checkmate", () => {
    const board: Board = Array(10).fill(null).map(() => Array(9).fill(null));
    board[9][4] = { type: "general", color: "red" };
    board[0][4] = { type: "general", color: "black" };
    // Two chariots creating checkmate
    board[9][0] = { type: "chariot", color: "black" };
    board[8][0] = { type: "chariot", color: "black" };

    // Red general at (9,4) is attacked by chariot at (9,0) along row 9
    // General can try to move to (8,4) but chariot at (8,0) attacks row 8
    // General can try (9,3) or (9,5) but chariot at (9,0) still attacks row 9
    // This should be checkmate
    expect(isCheckmate(board, "red")).toBe(true);
  });

  it("initial position is not checkmate", () => {
    const board = createInitialBoard();
    expect(isCheckmate(board, "red")).toBe(false);
    expect(isCheckmate(board, "black")).toBe(false);
  });
});

describe("makeMove", () => {
  it("moves a piece and returns captured piece", () => {
    const board: Board = Array(10).fill(null).map(() => Array(9).fill(null));
    board[5][0] = { type: "chariot", color: "red" };
    board[3][0] = { type: "soldier", color: "black" };
    board[9][4] = { type: "general", color: "red" };
    board[0][4] = { type: "general", color: "black" };

    const { newBoard, captured } = makeMove(board, { row: 5, col: 0 }, { row: 3, col: 0 });

    expect(newBoard[5][0]).toBeNull();
    expect(newBoard[3][0]).toEqual({ type: "chariot", color: "red" });
    expect(captured).toEqual({ type: "soldier", color: "black" });
  });

  it("does not mutate original board", () => {
    const board = createInitialBoard();
    const originalPiece = board[9][0];
    makeMove(board, { row: 9, col: 0 }, { row: 8, col: 0 });
    expect(board[9][0]).toEqual(originalPiece);
  });
});

describe("getAllValidMoves", () => {
  it("returns moves for all pieces of a color", () => {
    const board = createInitialBoard();
    const redMoves = getAllValidMoves(board, "red");
    const blackMoves = getAllValidMoves(board, "black");

    // Both sides should have valid moves in initial position
    expect(redMoves.length).toBeGreaterThan(0);
    expect(blackMoves.length).toBeGreaterThan(0);
  });
});

describe("cloneBoard", () => {
  it("creates a deep copy", () => {
    const board = createInitialBoard();
    const clone = cloneBoard(board);

    // Modify clone
    clone[9][0] = null;

    // Original should be unchanged
    expect(board[9][0]).not.toBeNull();
  });
});

describe("flying general rule", () => {
  it("prevents moves that expose generals facing each other", () => {
    const board: Board = Array(10).fill(null).map(() => Array(9).fill(null));
    board[9][4] = { type: "general", color: "red" };
    board[0][4] = { type: "general", color: "black" };
    board[5][4] = { type: "chariot", color: "red" }; // blocking piece

    // The chariot at (5,4) blocks the generals from facing each other
    // Moving it away from column 4 should be invalid if it exposes the generals
    const moves = getValidMoves(board, { row: 5, col: 4 });
    // Chariot should not be able to move to a position that leaves col 4 open between generals
    const movesLeavingCol4 = moves.filter(m => m.col !== 4);
    // All such moves should be filtered out because generals would face each other
    expect(movesLeavingCol4.length).toBe(0);
  });
});
