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

// ==================== Fast Move Generation for AI ====================
// Uses in-place make/undo to avoid cloning the board for every move legality check

// Pre-allocated constant arrays (avoid GC pressure from per-call allocation)
const ATTACK_DIRS_DR = [-1, 1, 0, 0];
const ATTACK_DIRS_DC = [0, 0, -1, 1];
const HORSE_ATK_DR = [-2, -2, 2, 2, -1, -1, 1, 1];
const HORSE_ATK_DC = [-1, 1, -1, 1, -2, 2, -2, 2];
const HORSE_ATK_BR = [-1, -1, 1, 1, 0, 0, 0, 0];
const HORSE_ATK_BC = [0, 0, 0, 0, -1, 1, -1, 1];

// Fast check if a specific square is attacked by the opponent
function isSquareAttacked(board: Board, targetRow: number, targetCol: number, byColor: PieceColor): boolean {
  // Check attacks by chariot/cannon along lines (unrolled directions)
  for (let d = 0; d < 4; d++) {
    const dr = ATTACK_DIRS_DR[d];
    const dc = ATTACK_DIRS_DC[d];
    let r = targetRow + dr;
    let c = targetCol + dc;
    let jumped = false;
    while (r >= 0 && r <= 9 && c >= 0 && c <= 8) {
      const p = board[r][c];
      if (p) {
        if (!jumped) {
          if (p.color === byColor) {
            if (p.type === 'chariot') return true;
            if (p.type === 'general') return true;
          }
          jumped = true;
        } else {
          if (p.color === byColor && p.type === 'cannon') return true;
          break;
        }
      }
      r += dr;
      c += dc;
    }
  }

  // Check attacks by horse (unrolled)
  for (let i = 0; i < 8; i++) {
    const hr = targetRow + HORSE_ATK_DR[i];
    const hc = targetCol + HORSE_ATK_DC[i];
    if (hr >= 0 && hr <= 9 && hc >= 0 && hc <= 8) {
      const blockR = targetRow + HORSE_ATK_BR[i];
      const blockC = targetCol + HORSE_ATK_BC[i];
      if (!board[blockR][blockC]) {
        const p = board[hr][hc];
        if (p && p.color === byColor && p.type === 'horse') return true;
      }
    }
  }

  // Check attacks by soldier
  if (byColor === 'red') {
    if (targetRow + 1 <= 9) {
      const p = board[targetRow + 1][targetCol];
      if (p && p.color === 'red' && p.type === 'soldier') return true;
    }
    if (targetCol - 1 >= 0) {
      const p = board[targetRow][targetCol - 1];
      if (p && p.color === 'red' && p.type === 'soldier' && targetRow <= 4) return true;
    }
    if (targetCol + 1 <= 8) {
      const p = board[targetRow][targetCol + 1];
      if (p && p.color === 'red' && p.type === 'soldier' && targetRow <= 4) return true;
    }
  } else {
    if (targetRow - 1 >= 0) {
      const p = board[targetRow - 1][targetCol];
      if (p && p.color === 'black' && p.type === 'soldier') return true;
    }
    if (targetCol - 1 >= 0) {
      const p = board[targetRow][targetCol - 1];
      if (p && p.color === 'black' && p.type === 'soldier' && targetRow >= 5) return true;
    }
    if (targetCol + 1 <= 8) {
      const p = board[targetRow][targetCol + 1];
      if (p && p.color === 'black' && p.type === 'soldier' && targetRow >= 5) return true;
    }
  }

  return false;
}

// Generate only capture moves (for quiescence search - much faster than generating all moves)
export function getCaptureMovesFast(board: Board, color: PieceColor): { from: Position; to: Position }[] {
  const captures: { from: Position; to: Position }[] = [];
  // Find general positions once
  let myGenRow = -1, myGenCol = -1, oppGenRow = -1, oppGenCol = -1;
  for (let row = 0; row <= 9; row++) {
    for (let col = 0; col <= 8; col++) {
      const p = board[row][col];
      if (p && p.type === 'general') {
        if (p.color === color) { myGenRow = row; myGenCol = col; }
        else { oppGenRow = row; oppGenCol = col; }
      }
    }
  }
  for (let row = 0; row <= 9; row++) {
    for (let col = 0; col <= 8; col++) {
      const piece = board[row][col];
      if (piece && piece.color === color) {
        const targets = getPseudoMoves(board, row, col, piece);
        for (const to of targets) {
          const victim = board[to.row][to.col];
          if (!victim) continue;
          
          // Track general position after move
          let curGenRow = myGenRow, curGenCol = myGenCol;
          let curOppRow = oppGenRow, curOppCol = oppGenCol;
          if (piece.type === 'general') { curGenRow = to.row; curGenCol = to.col; }
          if (victim.type === 'general') { curOppRow = -1; curOppCol = -1; }
          
          board[to.row][to.col] = piece;
          board[row][col] = null;
          if (!isInCheckFast(board, color, curGenRow, curGenCol) && !generalsAreFacingFast(board, color === 'red' ? curGenRow : curOppRow, color === 'red' ? curGenCol : curOppCol, color === 'black' ? curGenRow : curOppRow, color === 'black' ? curGenCol : curOppCol)) {
            captures.push({ from: { row, col }, to });
          }
          board[row][col] = piece;
          board[to.row][to.col] = victim;
        }
      }
    }
  }
  return captures;
}

// Fast isInCheck using isSquareAttacked - with optional known general position
function isInCheckFast(board: Board, color: PieceColor, knownRow?: number, knownCol?: number): boolean {
  let gRow = knownRow ?? -1;
  let gCol = knownCol ?? -1;
  if (gRow < 0) {
    const startRow = color === 'red' ? 7 : 0;
    const endRow = color === 'red' ? 9 : 2;
    for (let row = startRow; row <= endRow; row++) {
      for (let col = 3; col <= 5; col++) {
        const p = board[row][col];
        if (p && p.type === 'general' && p.color === color) {
          gRow = row; gCol = col;
          break;
        }
      }
      if (gRow >= 0) break;
    }
  }
  if (gRow < 0) return true; // General not found = captured
  const opponentColor = color === 'red' ? 'black' : 'red';
  return isSquareAttacked(board, gRow, gCol, opponentColor);
}

// Fast flying general check with known positions
function generalsAreFacingFast(board: Board, rRow?: number, rCol?: number, bRow?: number, bCol?: number): boolean {
  let redRow = rRow ?? -1, redCol = rCol ?? -1;
  let blackRow = bRow ?? -1, blackCol = bCol ?? -1;
  if (redRow < 0) {
    for (let row = 7; row <= 9; row++) {
      for (let col = 3; col <= 5; col++) {
        const p = board[row][col];
        if (p && p.type === 'general') { redRow = row; redCol = col; break; }
      }
      if (redRow >= 0) break;
    }
  }
  if (blackRow < 0) {
    for (let row = 0; row <= 2; row++) {
      for (let col = 3; col <= 5; col++) {
        const p = board[row][col];
        if (p && p.type === 'general') { blackRow = row; blackCol = col; break; }
      }
      if (blackRow >= 0) break;
    }
  }
  if (redCol < 0 || blackCol < 0 || redCol !== blackCol) return false;
  for (let row = blackRow + 1; row < redRow; row++) {
    if (board[row][redCol] !== null) return false;
  }
  return true;
}

// Generate pseudo-legal moves (without check validation) for a piece
function getPseudoMoves(board: Board, row: number, col: number, piece: Piece): Position[] {
  const moves: Position[] = [];
  const { type, color } = piece;

  switch (type) {
    case 'general': {
      const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
      for (const [dr, dc] of dirs) {
        const nr = row + dr, nc = col + dc;
        if (isInPalace(nr, nc, color)) {
          const t = board[nr][nc];
          if (!t || t.color !== color) moves.push({ row: nr, col: nc });
        }
      }
      break;
    }
    case 'advisor': {
      const dirs = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
      for (const [dr, dc] of dirs) {
        const nr = row + dr, nc = col + dc;
        if (isInPalace(nr, nc, color)) {
          const t = board[nr][nc];
          if (!t || t.color !== color) moves.push({ row: nr, col: nc });
        }
      }
      break;
    }
    case 'elephant': {
      const dirs = [[-2, -2], [-2, 2], [2, -2], [2, 2]];
      const blks = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
      for (let i = 0; i < 4; i++) {
        const nr = row + dirs[i][0], nc = col + dirs[i][1];
        if (nr >= 0 && nr <= 9 && nc >= 0 && nc <= 8 && isOnOwnSide(nr, color)) {
          if (!board[row + blks[i][0]][col + blks[i][1]]) {
            const t = board[nr][nc];
            if (!t || t.color !== color) moves.push({ row: nr, col: nc });
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
        const nr = row + dr, nc = col + dc;
        if (nr >= 0 && nr <= 9 && nc >= 0 && nc <= 8 && !board[row + br][col + bc]) {
          const t = board[nr][nc];
          if (!t || t.color !== color) moves.push({ row: nr, col: nc });
        }
      }
      break;
    }
    case 'chariot': {
      const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
      for (const [dr, dc] of dirs) {
        let nr = row + dr, nc = col + dc;
        while (nr >= 0 && nr <= 9 && nc >= 0 && nc <= 8) {
          const t = board[nr][nc];
          if (!t) { moves.push({ row: nr, col: nc }); }
          else { if (t.color !== color) moves.push({ row: nr, col: nc }); break; }
          nr += dr; nc += dc;
        }
      }
      break;
    }
    case 'cannon': {
      const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
      for (const [dr, dc] of dirs) {
        let nr = row + dr, nc = col + dc;
        let jumped = false;
        while (nr >= 0 && nr <= 9 && nc >= 0 && nc <= 8) {
          const t = board[nr][nc];
          if (!jumped) {
            if (!t) moves.push({ row: nr, col: nc });
            else jumped = true;
          } else {
            if (t) { if (t.color !== color) moves.push({ row: nr, col: nc }); break; }
          }
          nr += dr; nc += dc;
        }
      }
      break;
    }
    case 'soldier': {
      if (color === 'red') {
        if (row - 1 >= 0) { const t = board[row - 1][col]; if (!t || t.color !== color) moves.push({ row: row - 1, col }); }
        if (row <= 4) {
          if (col - 1 >= 0) { const t = board[row][col - 1]; if (!t || t.color !== color) moves.push({ row, col: col - 1 }); }
          if (col + 1 <= 8) { const t = board[row][col + 1]; if (!t || t.color !== color) moves.push({ row, col: col + 1 }); }
        }
      } else {
        if (row + 1 <= 9) { const t = board[row + 1][col]; if (!t || t.color !== color) moves.push({ row: row + 1, col }); }
        if (row >= 5) {
          if (col - 1 >= 0) { const t = board[row][col - 1]; if (!t || t.color !== color) moves.push({ row, col: col - 1 }); }
          if (col + 1 <= 8) { const t = board[row][col + 1]; if (!t || t.color !== color) moves.push({ row, col: col + 1 }); }
        }
      }
      break;
    }
  }
  return moves;
}

// Fast getAllValidMoves using in-place make/undo (avoids cloneBoard per move)
// Tracks general positions to avoid searching for them on every legality check
export function getAllValidMovesFast(board: Board, color: PieceColor): { from: Position; to: Position }[] {
  const allMoves: { from: Position; to: Position }[] = [];
  // Find general positions once at the start
  let myGenRow = -1, myGenCol = -1, oppGenRow = -1, oppGenCol = -1;
  for (let row = 0; row <= 9; row++) {
    for (let col = 0; col <= 8; col++) {
      const p = board[row][col];
      if (p && p.type === 'general') {
        if (p.color === color) { myGenRow = row; myGenCol = col; }
        else { oppGenRow = row; oppGenCol = col; }
      }
    }
  }
  for (let row = 0; row <= 9; row++) {
    for (let col = 0; col <= 8; col++) {
      const piece = board[row][col];
      if (piece && piece.color === color) {
        const targets = getPseudoMoves(board, row, col, piece);
        for (const to of targets) {
          const captured = board[to.row][to.col];
          
          // Track general position after this move
          let curGenRow = myGenRow, curGenCol = myGenCol;
          let curOppRow = oppGenRow, curOppCol = oppGenCol;
          if (piece.type === 'general') { curGenRow = to.row; curGenCol = to.col; }
          if (captured && captured.type === 'general') { curOppRow = -1; curOppCol = -1; }
          
          // Make move in place
          board[to.row][to.col] = piece;
          board[row][col] = null;

          // Check legality with known general positions
          if (!isInCheckFast(board, color, curGenRow, curGenCol) && 
              !generalsAreFacingFast(board, 
                color === 'red' ? curGenRow : curOppRow, 
                color === 'red' ? curGenCol : curOppCol, 
                color === 'black' ? curGenRow : curOppRow, 
                color === 'black' ? curGenCol : curOppCol)) {
            allMoves.push({ from: { row, col }, to });
          }

          // Undo move in place
          board[row][col] = piece;
          board[to.row][to.col] = captured;
        }
      }
    }
  }
  return allMoves;
}

// Fast isInCheck using the optimized square attack detection
export function isInCheckFastExport(board: Board, color: PieceColor): boolean {
  return isInCheckFast(board, color);
}

export function makeMove(board: Board, from: Position, to: Position): { newBoard: Board; captured: Piece | null } {
  const newBoard = cloneBoard(board);
  const captured = newBoard[to.row][to.col];
  newBoard[to.row][to.col] = newBoard[from.row][from.col];
  newBoard[from.row][from.col] = null;
  return { newBoard, captured };
}

export function posToNotation(pos: Position): string {
  const colNames = ['一', '二', '三', '四', '五', '六', '七', '八', '九'];
  return `${colNames[pos.col]}${9 - pos.row}`;
}

export function moveToNotation(move: Move): string {
  const pieceName = PIECE_CHARS[move.piece.color][move.piece.type];
  const from = posToNotation(move.from);
  const to = posToNotation(move.to);
  const action = move.captured ? '吃' : '→';
  return `${pieceName}${from}${action}${to}`;
}
