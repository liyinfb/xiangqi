// Chinese Chess (Xiangqi) Game Logic

export type PieceType = 'general' | 'advisor' | 'elephant' | 'horse' | 'chariot' | 'cannon' | 'soldier';
export type PieceColor = 'red' | 'black';

export interface Piece {
  type: PieceType;
  color: PieceColor;
}

export interface Position {
  row: number; // 0-9 (top to bottom)
  col: number; // 0-8 (left to right)
}

export interface Move {
  from: Position;
  to: Position;
  captured?: Piece;
  piece: Piece;
}

export type Board = (Piece | null)[][];

// Chinese characters for pieces
export const PIECE_CHARS: Record<PieceColor, Record<PieceType, string>> = {
  red: {
    general: '帥',
    advisor: '仕',
    elephant: '相',
    horse: '傌',
    chariot: '俥',
    cannon: '炮',
    soldier: '兵',
  },
  black: {
    general: '將',
    advisor: '士',
    elephant: '象',
    horse: '馬',
    chariot: '車',
    cannon: '砲',
    soldier: '卒',
  },
};

// Piece values for AI evaluation
export const PIECE_VALUES: Record<PieceType, number> = {
  general: 10000,
  advisor: 20,
  elephant: 20,
  horse: 40,
  chariot: 90,
  cannon: 45,
  soldier: 10,
};

// Position bonus tables for AI (simplified)
export const POSITION_BONUS: Record<PieceType, number[][]> = {
  general: Array(10).fill(null).map(() => Array(9).fill(0)),
  advisor: Array(10).fill(null).map(() => Array(9).fill(0)),
  elephant: Array(10).fill(null).map(() => Array(9).fill(0)),
  horse: [
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 1, 2, 2, 2, 2, 2, 1, 0],
    [0, 1, 3, 4, 4, 4, 3, 1, 0],
    [0, 2, 4, 5, 5, 5, 4, 2, 0],
    [0, 2, 4, 5, 5, 5, 4, 2, 0],
    [0, 1, 3, 4, 4, 4, 3, 1, 0],
    [0, 1, 2, 2, 2, 2, 2, 1, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
  ],
  chariot: [
    [0, 0, 0, 1, 1, 1, 0, 0, 0],
    [0, 0, 0, 1, 1, 1, 0, 0, 0],
    [0, 0, 1, 2, 2, 2, 1, 0, 0],
    [0, 1, 2, 3, 3, 3, 2, 1, 0],
    [1, 2, 3, 4, 4, 4, 3, 2, 1],
    [1, 2, 3, 4, 4, 4, 3, 2, 1],
    [0, 1, 2, 3, 3, 3, 2, 1, 0],
    [0, 0, 1, 2, 2, 2, 1, 0, 0],
    [0, 0, 0, 1, 1, 1, 0, 0, 0],
    [0, 0, 0, 1, 1, 1, 0, 0, 0],
  ],
  cannon: [
    [0, 0, 1, 1, 1, 1, 1, 0, 0],
    [0, 0, 1, 1, 1, 1, 1, 0, 0],
    [0, 1, 2, 2, 3, 2, 2, 1, 0],
    [0, 1, 2, 3, 3, 3, 2, 1, 0],
    [1, 2, 3, 4, 4, 4, 3, 2, 1],
    [1, 2, 3, 4, 4, 4, 3, 2, 1],
    [0, 1, 2, 3, 3, 3, 2, 1, 0],
    [0, 1, 2, 2, 3, 2, 2, 1, 0],
    [0, 0, 1, 1, 1, 1, 1, 0, 0],
    [0, 0, 1, 1, 1, 1, 1, 0, 0],
  ],
  soldier: [
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [1, 1, 1, 2, 2, 2, 1, 1, 1],
    [2, 2, 3, 4, 4, 4, 3, 2, 2],
    [3, 3, 4, 5, 5, 5, 4, 3, 3],
    [3, 4, 5, 6, 6, 6, 5, 4, 3],
    [4, 5, 6, 7, 7, 7, 6, 5, 4],
    [5, 6, 7, 8, 8, 8, 7, 6, 5],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
  ],
};

export function createInitialBoard(): Board {
  const board: Board = Array(10).fill(null).map(() => Array(9).fill(null));

  // Black pieces (top, rows 0-4)
  board[0][0] = { type: 'chariot', color: 'black' };
  board[0][1] = { type: 'horse', color: 'black' };
  board[0][2] = { type: 'elephant', color: 'black' };
  board[0][3] = { type: 'advisor', color: 'black' };
  board[0][4] = { type: 'general', color: 'black' };
  board[0][5] = { type: 'advisor', color: 'black' };
  board[0][6] = { type: 'elephant', color: 'black' };
  board[0][7] = { type: 'horse', color: 'black' };
  board[0][8] = { type: 'chariot', color: 'black' };
  board[2][1] = { type: 'cannon', color: 'black' };
  board[2][7] = { type: 'cannon', color: 'black' };
  board[3][0] = { type: 'soldier', color: 'black' };
  board[3][2] = { type: 'soldier', color: 'black' };
  board[3][4] = { type: 'soldier', color: 'black' };
  board[3][6] = { type: 'soldier', color: 'black' };
  board[3][8] = { type: 'soldier', color: 'black' };

  // Red pieces (bottom, rows 5-9)
  board[9][0] = { type: 'chariot', color: 'red' };
  board[9][1] = { type: 'horse', color: 'red' };
  board[9][2] = { type: 'elephant', color: 'red' };
  board[9][3] = { type: 'advisor', color: 'red' };
  board[9][4] = { type: 'general', color: 'red' };
  board[9][5] = { type: 'advisor', color: 'red' };
  board[9][6] = { type: 'elephant', color: 'red' };
  board[9][7] = { type: 'horse', color: 'red' };
  board[9][8] = { type: 'chariot', color: 'red' };
  board[7][1] = { type: 'cannon', color: 'red' };
  board[7][7] = { type: 'cannon', color: 'red' };
  board[6][0] = { type: 'soldier', color: 'red' };
  board[6][2] = { type: 'soldier', color: 'red' };
  board[6][4] = { type: 'soldier', color: 'red' };
  board[6][6] = { type: 'soldier', color: 'red' };
  board[6][8] = { type: 'soldier', color: 'red' };

  return board;
}

export function cloneBoard(board: Board): Board {
  return board.map(row => row.map(cell => cell ? { ...cell } : null));
}

function isInBounds(row: number, col: number): boolean {
  return row >= 0 && row <= 9 && col >= 0 && col <= 8;
}

function isInPalace(row: number, col: number, color: PieceColor): boolean {
  if (col < 3 || col > 5) return false;
  if (color === 'red') return row >= 7 && row <= 9;
  return row >= 0 && row <= 2;
}

function isOnOwnSide(row: number, color: PieceColor): boolean {
  if (color === 'red') return row >= 5;
  return row <= 4;
}

// Check if two generals face each other (flying general rule)
function generalsAreFacing(board: Board): boolean {
  let redGeneral: Position | null = null;
  let blackGeneral: Position | null = null;

  for (let row = 0; row <= 9; row++) {
    for (let col = 0; col <= 8; col++) {
      const piece = board[row][col];
      if (piece?.type === 'general') {
        if (piece.color === 'red') redGeneral = { row, col };
        else blackGeneral = { row, col };
      }
    }
  }

  if (!redGeneral || !blackGeneral) return false;
  if (redGeneral.col !== blackGeneral.col) return false;

  // Check if there are any pieces between them
  const minRow = Math.min(redGeneral.row, blackGeneral.row);
  const maxRow = Math.max(redGeneral.row, blackGeneral.row);
  for (let row = minRow + 1; row < maxRow; row++) {
    if (board[row][redGeneral.col] !== null) return false;
  }

  return true;
}

export function getValidMoves(board: Board, pos: Position): Position[] {
  const piece = board[pos.row][pos.col];
  if (!piece) return [];

  const moves: Position[] = [];
  const { row, col } = pos;
  const { type, color } = piece;

  switch (type) {
    case 'general': {
      const directions = [[-1, 0], [1, 0], [0, -1], [0, 1]];
      for (const [dr, dc] of directions) {
        const nr = row + dr;
        const nc = col + dc;
        if (isInPalace(nr, nc, color)) {
          const target = board[nr][nc];
          if (!target || target.color !== color) {
            moves.push({ row: nr, col: nc });
          }
        }
      }
      break;
    }

    case 'advisor': {
      const directions = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
      for (const [dr, dc] of directions) {
        const nr = row + dr;
        const nc = col + dc;
        if (isInPalace(nr, nc, color)) {
          const target = board[nr][nc];
          if (!target || target.color !== color) {
            moves.push({ row: nr, col: nc });
          }
        }
      }
      break;
    }

    case 'elephant': {
      const directions = [[-2, -2], [-2, 2], [2, -2], [2, 2]];
      const blocks = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
      for (let i = 0; i < directions.length; i++) {
        const [dr, dc] = directions[i];
        const [br, bc] = blocks[i];
        const nr = row + dr;
        const nc = col + dc;
        const blockRow = row + br;
        const blockCol = col + bc;
        if (isInBounds(nr, nc) && isOnOwnSide(nr, color)) {
          if (!board[blockRow][blockCol]) {
            const target = board[nr][nc];
            if (!target || target.color !== color) {
              moves.push({ row: nr, col: nc });
            }
          }
        }
      }
      break;
    }

    case 'horse': {
      const jumps = [
        [-2, -1, -1, 0], [-2, 1, -1, 0],
        [2, -1, 1, 0], [2, 1, 1, 0],
        [-1, -2, 0, -1], [-1, 2, 0, 1],
        [1, -2, 0, -1], [1, 2, 0, 1],
      ];
      for (const [dr, dc, br, bc] of jumps) {
        const nr = row + dr;
        const nc = col + dc;
        const blockRow = row + br;
        const blockCol = col + bc;
        if (isInBounds(nr, nc) && !board[blockRow][blockCol]) {
          const target = board[nr][nc];
          if (!target || target.color !== color) {
            moves.push({ row: nr, col: nc });
          }
        }
      }
      break;
    }

    case 'chariot': {
      const directions = [[-1, 0], [1, 0], [0, -1], [0, 1]];
      for (const [dr, dc] of directions) {
        let nr = row + dr;
        let nc = col + dc;
        while (isInBounds(nr, nc)) {
          const target = board[nr][nc];
          if (!target) {
            moves.push({ row: nr, col: nc });
          } else {
            if (target.color !== color) {
              moves.push({ row: nr, col: nc });
            }
            break;
          }
          nr += dr;
          nc += dc;
        }
      }
      break;
    }

    case 'cannon': {
      const directions = [[-1, 0], [1, 0], [0, -1], [0, 1]];
      for (const [dr, dc] of directions) {
        let nr = row + dr;
        let nc = col + dc;
        let jumped = false;
        while (isInBounds(nr, nc)) {
          const target = board[nr][nc];
          if (!jumped) {
            if (!target) {
              moves.push({ row: nr, col: nc });
            } else {
              jumped = true;
            }
          } else {
            if (target) {
              if (target.color !== color) {
                moves.push({ row: nr, col: nc });
              }
              break;
            }
          }
          nr += dr;
          nc += dc;
        }
      }
      break;
    }

    case 'soldier': {
      if (color === 'red') {
        // Red soldiers move up (decreasing row)
        if (row - 1 >= 0) {
          const target = board[row - 1][col];
          if (!target || target.color !== color) {
            moves.push({ row: row - 1, col });
          }
        }
        // After crossing river (row <= 4), can move sideways
        if (!isOnOwnSide(row, color)) {
          if (col - 1 >= 0) {
            const target = board[row][col - 1];
            if (!target || target.color !== color) {
              moves.push({ row, col: col - 1 });
            }
          }
          if (col + 1 <= 8) {
            const target = board[row][col + 1];
            if (!target || target.color !== color) {
              moves.push({ row, col: col + 1 });
            }
          }
        }
      } else {
        // Black soldiers move down (increasing row)
        if (row + 1 <= 9) {
          const target = board[row + 1][col];
          if (!target || target.color !== color) {
            moves.push({ row: row + 1, col });
          }
        }
        // After crossing river (row >= 5), can move sideways
        if (!isOnOwnSide(row, color)) {
          if (col - 1 >= 0) {
            const target = board[row][col - 1];
            if (!target || target.color !== color) {
              moves.push({ row, col: col - 1 });
            }
          }
          if (col + 1 <= 8) {
            const target = board[row][col + 1];
            if (!target || target.color !== color) {
              moves.push({ row, col: col + 1 });
            }
          }
        }
      }
      break;
    }
  }

  // Filter out moves that would leave own king in check or violate flying general rule
  return moves.filter(move => {
    const newBoard = cloneBoard(board);
    newBoard[move.row][move.col] = newBoard[pos.row][pos.col];
    newBoard[pos.row][pos.col] = null;
    return !isInCheck(newBoard, color) && !generalsAreFacing(newBoard);
  });
}

export function isInCheck(board: Board, color: PieceColor): boolean {
  // Find the general
  let generalPos: Position | null = null;
  for (let row = 0; row <= 9; row++) {
    for (let col = 0; col <= 8; col++) {
      const piece = board[row][col];
      if (piece?.type === 'general' && piece.color === color) {
        generalPos = { row, col };
        break;
      }
    }
    if (generalPos) break;
  }

  if (!generalPos) return true; // General captured = in check

  const opponentColor = color === 'red' ? 'black' : 'red';

  // Check if any opponent piece can attack the general
  for (let row = 0; row <= 9; row++) {
    for (let col = 0; col <= 8; col++) {
      const piece = board[row][col];
      if (piece && piece.color === opponentColor) {
        const attacks = getRawMoves(board, { row, col });
        if (attacks.some(m => m.row === generalPos!.row && m.col === generalPos!.col)) {
          return true;
        }
      }
    }
  }

  return false;
}

// Get raw moves without checking for self-check (to avoid infinite recursion)
function getRawMoves(board: Board, pos: Position): Position[] {
  const piece = board[pos.row][pos.col];
  if (!piece) return [];

  const moves: Position[] = [];
  const { row, col } = pos;
  const { type, color } = piece;

  switch (type) {
    case 'general': {
      const directions = [[-1, 0], [1, 0], [0, -1], [0, 1]];
      for (const [dr, dc] of directions) {
        const nr = row + dr;
        const nc = col + dc;
        if (isInPalace(nr, nc, color)) {
          const target = board[nr][nc];
          if (!target || target.color !== color) {
            moves.push({ row: nr, col: nc });
          }
        }
      }
      break;
    }
    case 'advisor': {
      const directions = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
      for (const [dr, dc] of directions) {
        const nr = row + dr;
        const nc = col + dc;
        if (isInPalace(nr, nc, color)) {
          const target = board[nr][nc];
          if (!target || target.color !== color) {
            moves.push({ row: nr, col: nc });
          }
        }
      }
      break;
    }
    case 'elephant': {
      const directions = [[-2, -2], [-2, 2], [2, -2], [2, 2]];
      const blocks = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
      for (let i = 0; i < directions.length; i++) {
        const [dr, dc] = directions[i];
        const [br, bc] = blocks[i];
        const nr = row + dr;
        const nc = col + dc;
        const blockRow = row + br;
        const blockCol = col + bc;
        if (isInBounds(nr, nc) && isOnOwnSide(nr, color)) {
          if (!board[blockRow][blockCol]) {
            const target = board[nr][nc];
            if (!target || target.color !== color) {
              moves.push({ row: nr, col: nc });
            }
          }
        }
      }
      break;
    }
    case 'horse': {
      const jumps = [
        [-2, -1, -1, 0], [-2, 1, -1, 0],
        [2, -1, 1, 0], [2, 1, 1, 0],
        [-1, -2, 0, -1], [-1, 2, 0, 1],
        [1, -2, 0, -1], [1, 2, 0, 1],
      ];
      for (const [dr, dc, br, bc] of jumps) {
        const nr = row + dr;
        const nc = col + dc;
        const blockRow = row + br;
        const blockCol = col + bc;
        if (isInBounds(nr, nc) && !board[blockRow][blockCol]) {
          const target = board[nr][nc];
          if (!target || target.color !== color) {
            moves.push({ row: nr, col: nc });
          }
        }
      }
      break;
    }
    case 'chariot': {
      const directions = [[-1, 0], [1, 0], [0, -1], [0, 1]];
      for (const [dr, dc] of directions) {
        let nr = row + dr;
        let nc = col + dc;
        while (isInBounds(nr, nc)) {
          const target = board[nr][nc];
          if (!target) {
            moves.push({ row: nr, col: nc });
          } else {
            if (target.color !== color) moves.push({ row: nr, col: nc });
            break;
          }
          nr += dr;
          nc += dc;
        }
      }
      break;
    }
    case 'cannon': {
      const directions = [[-1, 0], [1, 0], [0, -1], [0, 1]];
      for (const [dr, dc] of directions) {
        let nr = row + dr;
        let nc = col + dc;
        let jumped = false;
        while (isInBounds(nr, nc)) {
          const target = board[nr][nc];
          if (!jumped) {
            if (!target) {
              moves.push({ row: nr, col: nc });
            } else {
              jumped = true;
            }
          } else {
            if (target) {
              if (target.color !== color) moves.push({ row: nr, col: nc });
              break;
            }
          }
          nr += dr;
          nc += dc;
        }
      }
      break;
    }
    case 'soldier': {
      if (color === 'red') {
        if (row - 1 >= 0) {
          const target = board[row - 1][col];
          if (!target || target.color !== color) moves.push({ row: row - 1, col });
        }
        if (!isOnOwnSide(row, color)) {
          if (col - 1 >= 0) {
            const target = board[row][col - 1];
            if (!target || target.color !== color) moves.push({ row, col: col - 1 });
          }
          if (col + 1 <= 8) {
            const target = board[row][col + 1];
            if (!target || target.color !== color) moves.push({ row, col: col + 1 });
          }
        }
      } else {
        if (row + 1 <= 9) {
          const target = board[row + 1][col];
          if (!target || target.color !== color) moves.push({ row: row + 1, col });
        }
        if (!isOnOwnSide(row, color)) {
          if (col - 1 >= 0) {
            const target = board[row][col - 1];
            if (!target || target.color !== color) moves.push({ row, col: col - 1 });
          }
          if (col + 1 <= 8) {
            const target = board[row][col + 1];
            if (!target || target.color !== color) moves.push({ row, col: col + 1 });
          }
        }
      }
      break;
    }
  }

  return moves;
}

export function isCheckmate(board: Board, color: PieceColor): boolean {
  // If the player has any valid move, it's not checkmate
  for (let row = 0; row <= 9; row++) {
    for (let col = 0; col <= 8; col++) {
      const piece = board[row][col];
      if (piece && piece.color === color) {
        const moves = getValidMoves(board, { row, col });
        if (moves.length > 0) return false;
      }
    }
  }
  return true;
}

export function getAllValidMoves(board: Board, color: PieceColor): { from: Position; to: Position }[] {
  const allMoves: { from: Position; to: Position }[] = [];
  for (let row = 0; row <= 9; row++) {
    for (let col = 0; col <= 8; col++) {
      const piece = board[row][col];
      if (piece && piece.color === color) {
        const moves = getValidMoves(board, { row, col });
        for (const to of moves) {
          allMoves.push({ from: { row, col }, to });
        }
      }
    }
  }
  return allMoves;
}

export function makeMove(board: Board, from: Position, to: Position): { newBoard: Board; captured: Piece | null } {
  const newBoard = cloneBoard(board);
  const captured = newBoard[to.row][to.col];
  newBoard[to.row][to.col] = newBoard[from.row][from.col];
  newBoard[from.row][from.col] = null;
  return { newBoard, captured };
}

export function posToNotation(pos: Position): string {
  const colNames = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i'];
  return `${colNames[pos.col]}${9 - pos.row}`;
}

export function moveToNotation(move: Move): string {
  const pieceName = PIECE_CHARS[move.piece.color][move.piece.type];
  const from = posToNotation(move.from);
  const to = posToNotation(move.to);
  const capture = move.captured ? 'x' : '-';
  return `${pieceName}${from}${capture}${to}`;
}
