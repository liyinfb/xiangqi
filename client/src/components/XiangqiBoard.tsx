import React from 'react';
import { Board, Position, Piece, PieceColor, PIECE_CHARS } from '@/lib/xiangqi';

interface XiangqiBoardProps {
  board: Board;
  selectedPosition: Position | null;
  validMoves: Position[];
  lastMove: { from: Position; to: Position } | null;
  onCellClick: (row: number, col: number) => void;
  currentTurn: PieceColor;
  playerColor: PieceColor;
  disabled?: boolean;
}

export default function XiangqiBoard({
  board,
  selectedPosition,
  validMoves,
  lastMove,
  onCellClick,
  currentTurn,
  playerColor,
  disabled = false,
}: XiangqiBoardProps) {
  const cellSize = 64;
  const padding = 40;
  const boardWidth = 8 * cellSize;
  const boardHeight = 9 * cellSize;
  const svgWidth = boardWidth + padding * 2;
  const svgHeight = boardHeight + padding * 2;

  // When playing as black, flip the board so black is at bottom
  const flipped = playerColor === 'black';

  // Convert logical row/col to visual coordinates
  const toVisualX = (col: number) => {
    const visualCol = flipped ? 8 - col : col;
    return padding + visualCol * cellSize;
  };
  const toVisualY = (row: number) => {
    const visualRow = flipped ? 9 - row : row;
    return padding + visualRow * cellSize;
  };

  const isSelected = (row: number, col: number) =>
    selectedPosition?.row === row && selectedPosition?.col === col;

  const isValidMove = (row: number, col: number) =>
    validMoves.some(m => m.row === row && m.col === col);

  const isLastMovePos = (row: number, col: number) =>
    lastMove && ((lastMove.from.row === row && lastMove.from.col === col) ||
      (lastMove.to.row === row && lastMove.to.col === col));

  // Draw the board grid lines
  const renderGrid = () => {
    const lines: React.JSX.Element[] = [];

    // Horizontal lines
    for (let row = 0; row <= 9; row++) {
      lines.push(
        <line
          key={`h-${row}`}
          x1={padding}
          y1={padding + row * cellSize}
          x2={padding + 8 * cellSize}
          y2={padding + row * cellSize}
          stroke="#5c3d2e"
          strokeWidth="1.2"
        />
      );
    }

    // Vertical lines (with river gap)
    for (let col = 0; col <= 8; col++) {
      if (col === 0 || col === 8) {
        lines.push(
          <line
            key={`v-${col}`}
            x1={padding + col * cellSize}
            y1={padding}
            x2={padding + col * cellSize}
            y2={padding + 9 * cellSize}
            stroke="#5c3d2e"
            strokeWidth="1.2"
          />
        );
      } else {
        lines.push(
          <line
            key={`v-${col}-top`}
            x1={padding + col * cellSize}
            y1={padding}
            x2={padding + col * cellSize}
            y2={padding + 4 * cellSize}
            stroke="#5c3d2e"
            strokeWidth="1.2"
          />
        );
        lines.push(
          <line
            key={`v-${col}-bottom`}
            x1={padding + col * cellSize}
            y1={padding + 5 * cellSize}
            x2={padding + col * cellSize}
            y2={padding + 9 * cellSize}
            stroke="#5c3d2e"
            strokeWidth="1.2"
          />
        );
      }
    }

    // Palace diagonals (visual positions, always same on screen)
    lines.push(
      <line key="palace-top-1" x1={padding + 3 * cellSize} y1={padding} x2={padding + 5 * cellSize} y2={padding + 2 * cellSize} stroke="#5c3d2e" strokeWidth="1" />,
      <line key="palace-top-2" x1={padding + 5 * cellSize} y1={padding} x2={padding + 3 * cellSize} y2={padding + 2 * cellSize} stroke="#5c3d2e" strokeWidth="1" />
    );
    lines.push(
      <line key="palace-bot-1" x1={padding + 3 * cellSize} y1={padding + 7 * cellSize} x2={padding + 5 * cellSize} y2={padding + 9 * cellSize} stroke="#5c3d2e" strokeWidth="1" />,
      <line key="palace-bot-2" x1={padding + 5 * cellSize} y1={padding + 7 * cellSize} x2={padding + 3 * cellSize} y2={padding + 9 * cellSize} stroke="#5c3d2e" strokeWidth="1" />
    );

    return lines;
  };

  // River text - flipped when playing as black
  const renderRiver = () => {
    const leftText = flipped ? '漢界' : '楚河';
    const rightText = flipped ? '楚河' : '漢界';
    return (
      <g>
        <text
          x={padding + 1.5 * cellSize}
          y={padding + 4.55 * cellSize}
          textAnchor="middle"
          className="select-none"
          style={{ fontSize: '22px', fill: '#5c3d2e', fontFamily: 'serif', letterSpacing: '8px' }}
        >
          {leftText}
        </text>
        <text
          x={padding + 6.5 * cellSize}
          y={padding + 4.55 * cellSize}
          textAnchor="middle"
          className="select-none"
          style={{ fontSize: '22px', fill: '#5c3d2e', fontFamily: 'serif', letterSpacing: '8px' }}
        >
          {rightText}
        </text>
      </g>
    );
  };

  // Render a piece
  const renderPiece = (piece: Piece, row: number, col: number) => {
    const x = toVisualX(col);
    const y = toVisualY(row);
    const selected = isSelected(row, col);
    const char = PIECE_CHARS[piece.color][piece.type];

    return (
      <g
        key={`piece-${row}-${col}`}
        onClick={() => !disabled && onCellClick(row, col)}
        className={disabled ? '' : 'cursor-pointer'}
      >
        {/* Piece shadow */}
        <circle
          cx={x}
          cy={y + 2}
          r={26}
          fill="rgba(0,0,0,0.15)"
        />
        {/* Piece body */}
        <circle
          cx={x}
          cy={y}
          r={26}
          fill={selected ? '#fff3cd' : '#fdf6e3'}
          stroke={selected ? '#d4a017' : piece.color === 'red' ? '#8b1a1a' : '#1a1a2e'}
          strokeWidth={selected ? 3 : 2.5}
        />
        {/* Inner ring */}
        <circle
          cx={x}
          cy={y}
          r={22}
          fill="none"
          stroke={piece.color === 'red' ? '#c0392b' : '#2c3e50'}
          strokeWidth="1"
        />
        {/* Piece character */}
        <text
          x={x}
          y={y + 8}
          textAnchor="middle"
          style={{
            fontSize: '24px',
            fontWeight: 'bold',
            fontFamily: '"Noto Serif SC", "SimSun", serif',
            fill: piece.color === 'red' ? '#c0392b' : '#2c3e50',
            userSelect: 'none',
          }}
        >
          {char}
        </text>
      </g>
    );
  };

  // Render valid move indicators
  const renderValidMoves = () => {
    return validMoves.map(({ row, col }) => {
      const x = toVisualX(col);
      const y = toVisualY(row);
      const hasCapture = board[row][col] !== null;

      if (hasCapture) {
        return (
          <circle
            key={`valid-${row}-${col}`}
            cx={x}
            cy={y}
            r={28}
            fill="none"
            stroke="rgba(231, 76, 60, 0.6)"
            strokeWidth="3"
            strokeDasharray="4 3"
            onClick={() => !disabled && onCellClick(row, col)}
            className={disabled ? '' : 'cursor-pointer'}
          />
        );
      }

      return (
        <circle
          key={`valid-${row}-${col}`}
          cx={x}
          cy={y}
          r={10}
          fill="rgba(46, 204, 113, 0.5)"
          onClick={() => !disabled && onCellClick(row, col)}
          className={disabled ? '' : 'cursor-pointer'}
        />
      );
    });
  };

  // Render last move highlight
  const renderLastMove = () => {
    if (!lastMove) return null;
    const highlights = [lastMove.from, lastMove.to];
    return highlights.map(({ row, col }) => {
      const x = toVisualX(col);
      const y = toVisualY(row);
      return (
        <rect
          key={`last-${row}-${col}`}
          x={x - 30}
          y={y - 30}
          width={60}
          height={60}
          fill="rgba(241, 196, 15, 0.2)"
          rx={4}
        />
      );
    });
  };

  // Click handler for empty intersections
  const renderClickTargets = () => {
    const targets: React.JSX.Element[] = [];
    for (let row = 0; row <= 9; row++) {
      for (let col = 0; col <= 8; col++) {
        if (!board[row][col]) {
          const x = toVisualX(col);
          const y = toVisualY(row);
          targets.push(
            <circle
              key={`target-${row}-${col}`}
              cx={x}
              cy={y}
              r={26}
              fill="transparent"
              onClick={() => !disabled && onCellClick(row, col)}
              className={disabled ? '' : 'cursor-pointer'}
            />
          );
        }
      }
    }
    return targets;
  };

  return (
    <div className="flex justify-center items-center w-full h-full">
      <svg
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        className="w-full h-full max-w-[600px] lg:max-w-none drop-shadow-xl"
        preserveAspectRatio="xMidYMid meet"
        style={{ background: 'linear-gradient(135deg, #f5e6d3 0%, #ede0d0 100%)' }}
      >
        {/* Board background */}
        <rect
          x={padding - 15}
          y={padding - 15}
          width={boardWidth + 30}
          height={boardHeight + 30}
          fill="#e8d5b7"
          stroke="#8b6914"
          strokeWidth="3"
          rx="2"
        />
        <rect
          x={padding - 10}
          y={padding - 10}
          width={boardWidth + 20}
          height={boardHeight + 20}
          fill="none"
          stroke="#a0845c"
          strokeWidth="1.5"
          rx="1"
        />

        {/* Grid */}
        {renderGrid()}

        {/* River */}
        {renderRiver()}

        {/* Last move highlight */}
        {renderLastMove()}

        {/* Valid move indicators */}
        {renderValidMoves()}

        {/* Click targets for empty cells */}
        {renderClickTargets()}

        {/* Pieces */}
        {board.map((row, rowIdx) =>
          row.map((piece, colIdx) =>
            piece ? renderPiece(piece, rowIdx, colIdx) : null
          )
        )}
      </svg>
    </div>
  );
}
