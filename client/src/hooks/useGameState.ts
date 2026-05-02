import { useState, useCallback, useRef, useEffect } from 'react';
import { trpc } from '@/lib/trpc';
import {
  Board,
  Piece,
  PieceColor,
  Position,
  Move,
  createInitialBoard,
  getValidMoves,
  makeMove,
  isInCheck,
  isCheckmate,
  moveToNotation,
  PIECE_CHARS,
} from '@/lib/xiangqi';
import { Difficulty, describeMoveContext, AIMove } from '@/lib/ai';
import { lookupOpeningBook, getOpeningName } from '@/lib/openingBook';
import { playMoveSound, playCaptureSound, playCheckSound, playGameOverSound, playNewGameSound } from '@/lib/sounds';
import type { AIWorkerRequest, AIWorkerResponse } from '@/lib/ai.worker';

export type GameStatus = 'playing' | 'red_wins' | 'black_wins' | 'stalemate';

export interface AIThinkingProgress {
  currentDepth: number;
  timeElapsed: number;
  nodesSearched?: number;
  isFromBook: boolean;
  openingName?: string;
}

export interface GameState {
  board: Board;
  currentTurn: PieceColor;
  selectedPosition: Position | null;
  validMoves: Position[];
  moveHistory: Move[];
  capturedPieces: { red: Piece[]; black: Piece[] };
  status: GameStatus;
  isInCheck: boolean;
  difficulty: Difficulty;
  aiThinking: boolean;
  aiExplanation: string;
  aiExplanationEnabled: boolean;
  aiExplanationLoading: boolean;
  lastMove: { from: Position; to: Position } | null;
}

export function useGameState() {
  const [board, setBoard] = useState<Board>(createInitialBoard());
  const [currentTurn, setCurrentTurn] = useState<PieceColor>('red');
  const [selectedPosition, setSelectedPosition] = useState<Position | null>(null);
  const [validMoves, setValidMoves] = useState<Position[]>([]);
  const [moveHistory, setMoveHistory] = useState<Move[]>([]);
  const [capturedPieces, setCapturedPieces] = useState<{ red: Piece[]; black: Piece[] }>({ red: [], black: [] });
  const [status, setStatus] = useState<GameStatus>('playing');
  const [checkState, setCheckState] = useState(false);
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [aiThinking, setAiThinking] = useState(false);
  const [aiExplanation, setAiExplanation] = useState('');
  const [aiExplanationEnabled, setAiExplanationEnabled] = useState(false);
  const [aiExplanationLoading, setAiExplanationLoading] = useState(false);
  const [aiSearchDepth, setAiSearchDepth] = useState<number | null>(null);
  const [aiScore, setAiScore] = useState<number | null>(null);
  const [lastMove, setLastMove] = useState<{ from: Position; to: Position } | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  
  // AI thinking progress state
  const [aiThinkingProgress, setAiThinkingProgress] = useState<AIThinkingProgress | null>(null);

  // Use ref to track board history for undo
  const boardHistory = useRef<Board[]>([createInitialBoard()]);
  const turnHistory = useRef<PieceColor[]>(['red']);

  // Web Worker ref
  const workerRef = useRef<Worker | null>(null);
  const pendingBoardRef = useRef<Board | null>(null);
  const requestIdRef = useRef<number>(0);
  const isNewGameRef = useRef(true);
  const aiExplanationEnabledRef = useRef(aiExplanationEnabled);
  const difficultyRef = useRef(difficulty);
  const thinkingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const thinkingStartRef = useRef<number>(0);
  const moveHistoryRef = useRef<{ from: Position; to: Position }[]>([]);

  // Keep refs in sync with state
  aiExplanationEnabledRef.current = aiExplanationEnabled;
  difficultyRef.current = difficulty;

  // Initialize Web Worker
  useEffect(() => {
    const worker = new Worker(
      new URL('../lib/ai.worker.ts', import.meta.url),
      { type: 'module' }
    );
    workerRef.current = worker;

    worker.onmessage = (e: MessageEvent<any>) => {
      const data = e.data;
      
      // Handle progress updates
      if (data.type === 'progress') {
        if (data.requestId !== undefined && data.requestId !== requestIdRef.current) return;
        setAiThinkingProgress({
          currentDepth: data.depth,
          timeElapsed: data.elapsed,
          nodesSearched: data.nodes,
          isFromBook: false,
        });
        return;
      }
      
      // Handle final result
      const { move: aiMove, requestId } = data;
      const currentBoard = pendingBoardRef.current;
      if (!currentBoard) return;

      // Ignore stale responses from previous requests
      if (requestId !== undefined && requestId !== requestIdRef.current) return;

      // Stop thinking progress timer
      if (thinkingTimerRef.current) {
        clearInterval(thinkingTimerRef.current);
        thinkingTimerRef.current = null;
      }

      handleAIResponseFromWorker(currentBoard, aiMove);
    };

    return () => {
      worker.terminate();
      if (thinkingTimerRef.current) {
        clearInterval(thinkingTimerRef.current);
      }
    };
  }, []);

  const handleAIResponseFromWorker = useCallback((currentBoard: Board, aiMove: AIMove | null) => {
    if (!aiMove) {
      setStatus('red_wins');
      setAiThinking(false);
      setAiThinkingProgress(null);
      if (soundEnabled) playGameOverSound();
      return;
    }

    const piece = currentBoard[aiMove.from.row][aiMove.from.col];
    if (!piece) {
      setAiThinking(false);
      setAiThinkingProgress(null);
      return;
    }

    const { newBoard, captured } = makeMove(currentBoard, aiMove.from, aiMove.to);
    const move: Move = { from: aiMove.from, to: aiMove.to, piece, captured: captured || undefined };

    setBoard(newBoard);
    setLastMove({ from: aiMove.from, to: aiMove.to });
    setMoveHistory(prev => {
      const newHistory = [...prev, move];
      moveHistoryRef.current = newHistory.map(m => ({ from: m.from, to: m.to }));
      return newHistory;
    });

    if (captured) {
      setCapturedPieces(prev => ({
        ...prev,
        black: [...prev.black, captured],
      }));
    }

    // Play sound
    if (soundEnabled) {
      if (captured) {
        playCaptureSound();
      } else {
        playMoveSound();
      }
    }

    // Save to history for undo
    boardHistory.current.push(newBoard);
    turnHistory.current.push('red');

    // Check game status
    if (isCheckmate(newBoard, 'red')) {
      setStatus('black_wins');
      setCurrentTurn('red');
      setCheckState(false);
      setAiThinking(false);
      setAiThinkingProgress(null);
      if (soundEnabled) playGameOverSound();
      return;
    }

    const inCheck = isInCheck(newBoard, 'red');
    setCheckState(inCheck);
    if (inCheck && soundEnabled) {
      playCheckSound();
    }
    setCurrentTurn('red');
    setAiThinking(false);
    setAiThinkingProgress(null);

    // Store search metadata for display
    setAiSearchDepth(aiMove.searchDepth);
    setAiScore(aiMove.score);

    // Get AI explanation if enabled (use ref to get current value)
    if (aiExplanationEnabledRef.current) {
      fetchAIExplanation(currentBoard, aiMove.from, aiMove.to, aiMove.searchDepth, aiMove.score);
    }
  }, [soundEnabled]);

  const handleCellClick = useCallback((row: number, col: number) => {
    if (status !== 'playing' || currentTurn !== 'red' || aiThinking) return;

    const clickedPiece = board[row][col];

    // If clicking own piece, select it
    if (clickedPiece && clickedPiece.color === 'red') {
      setSelectedPosition({ row, col });
      const moves = getValidMoves(board, { row, col });
      setValidMoves(moves);
      return;
    }

    // If a piece is selected and clicking a valid move target
    if (selectedPosition) {
      const isValid = validMoves.some(m => m.row === row && m.col === col);
      if (isValid) {
        executeMove(selectedPosition, { row, col });
      } else {
        setSelectedPosition(null);
        setValidMoves([]);
      }
    }
  }, [board, currentTurn, selectedPosition, validMoves, status, aiThinking]);

  const executeMove = useCallback((from: Position, to: Position) => {
    const piece = board[from.row][from.col];
    if (!piece) return;

    const { newBoard, captured } = makeMove(board, from, to);

    const move: Move = { from, to, piece, captured: captured || undefined };

    setBoard(newBoard);
    setLastMove({ from, to });
    setMoveHistory(prev => {
      const newHistory = [...prev, move];
      moveHistoryRef.current = newHistory.map(m => ({ from: m.from, to: m.to }));
      return newHistory;
    });
    setSelectedPosition(null);
    setValidMoves([]);

    if (captured) {
      setCapturedPieces(prev => ({
        ...prev,
        [piece.color]: [...prev[piece.color], captured],
      }));
    }

    // Play sound
    if (soundEnabled) {
      if (captured) {
        playCaptureSound();
      } else {
        playMoveSound();
      }
    }

    // Save to history for undo
    boardHistory.current.push(newBoard);
    turnHistory.current.push('black');

    // Check game status
    if (isCheckmate(newBoard, 'black')) {
      setStatus('red_wins');
      setCurrentTurn('black');
      setCheckState(false);
      if (soundEnabled) playGameOverSound();
      return;
    }

    const inCheck = isInCheck(newBoard, 'black');
    setCheckState(inCheck);
    if (inCheck && soundEnabled) {
      playCheckSound();
    }
    setCurrentTurn('black');

    // Trigger AI move
    setTimeout(() => {
      makeAIMove(newBoard);
    }, 200);
  }, [board, difficulty, aiExplanationEnabled, soundEnabled]);

  const makeAIMove = useCallback((currentBoard: Board) => {
    setAiThinking(true);
    pendingBoardRef.current = currentBoard;
    requestIdRef.current++;
    const currentRequestId = requestIdRef.current;

    // Check opening book first
    const bookMove = lookupOpeningBook(moveHistoryRef.current, 'black');
    if (bookMove) {
      // Verify the book move is valid on the current board
      const piece = currentBoard[bookMove.from.row][bookMove.from.col];
      if (piece && piece.color === 'black') {
        setAiThinkingProgress({
          currentDepth: 0,
          timeElapsed: 0,
          isFromBook: true,
          openingName: bookMove.name,
        });
        
        // Simulate brief thinking time for natural feel
        setTimeout(() => {
          if (requestIdRef.current !== currentRequestId) return;
          
          const aiMove: AIMove = {
            from: bookMove.from,
            to: bookMove.to,
            score: 0,
            searchDepth: 0,
            nodesSearched: 0,
          };
          handleAIResponseFromWorker(currentBoard, aiMove);
          
          // Set special metadata for book move
          setAiSearchDepth(0);
          setAiScore(null);
          setAiThinkingProgress({
            currentDepth: 0,
            timeElapsed: 0,
            isFromBook: true,
            openingName: bookMove.name,
          });
        }, 300 + Math.random() * 400); // 300-700ms delay for natural feel
        return;
      }
    }

    // Initialize thinking progress (real updates come from worker)
    thinkingStartRef.current = Date.now();
    setAiThinkingProgress({
      currentDepth: 0,
      timeElapsed: 0,
      nodesSearched: 0,
      isFromBook: false,
    });
    
    // Timer only updates elapsed time display; depth/nodes come from worker
    thinkingTimerRef.current = setInterval(() => {
      const elapsed = Date.now() - thinkingStartRef.current;
      setAiThinkingProgress(prev => prev ? {
        ...prev,
        timeElapsed: elapsed,
      } : null);
    }, 100);

    if (workerRef.current) {
      const request = {
        board: currentBoard,
        aiColor: 'black' as const,
        difficulty: difficultyRef.current,
        requestId: currentRequestId,
        isNewGame: isNewGameRef.current,
      };
      isNewGameRef.current = false;
      workerRef.current.postMessage(request);
    } else {
      // Fallback: run in main thread if worker not available
      import('../lib/ai').then(({ getBestMove }) => {
        if (requestIdRef.current !== currentRequestId) return;
        const aiMove = getBestMove(currentBoard, 'black', difficultyRef.current);
        if (thinkingTimerRef.current) {
          clearInterval(thinkingTimerRef.current);
          thinkingTimerRef.current = null;
        }
        handleAIResponseFromWorker(currentBoard, aiMove);
      });
    }
  }, [handleAIResponseFromWorker]);

  const explainMutation = trpc.game.explainMove.useMutation({
    onSuccess: (data) => {
      setAiExplanation(data as string);
      setAiExplanationLoading(false);
    },
    onError: () => {
      setAiExplanation('暂时无法生成解说，请稍后再试。');
      setAiExplanationLoading(false);
    },
  });

  const fetchAIExplanation = useCallback((boardState: Board, from: Position, to: Position, searchDepth: number, score: number) => {
    setAiExplanationLoading(true);
    const context = describeMoveContext(boardState, from, to, 'black');
    const difficultyLabel = difficulty === 'easy' ? '简单' : difficulty === 'medium' ? '中等' : '困难';
    explainMutation.mutate({ context, searchDepth, score, difficulty: difficultyLabel });
  }, [explainMutation, difficulty]);

  const newGame = useCallback(() => {
    requestIdRef.current++; // Invalidate any pending AI response
    isNewGameRef.current = true; // Signal worker to reset move counter
    if (thinkingTimerRef.current) {
      clearInterval(thinkingTimerRef.current);
      thinkingTimerRef.current = null;
    }
    const initialBoard = createInitialBoard();
    setBoard(initialBoard);
    setCurrentTurn('red');
    setSelectedPosition(null);
    setValidMoves([]);
    setMoveHistory([]);
    moveHistoryRef.current = [];
    setCapturedPieces({ red: [], black: [] });
    setStatus('playing');
    setCheckState(false);
    setAiThinking(false);
    setAiExplanation('');
    setAiSearchDepth(null);
    setAiScore(null);
    setLastMove(null);
    setAiThinkingProgress(null);
    boardHistory.current = [initialBoard];
    turnHistory.current = ['red'];
    if (soundEnabled) playNewGameSound();
  }, [soundEnabled]);

  const undoMove = useCallback(() => {
    if (moveHistory.length < 2 || aiThinking) return; // Undo both player and AI move

    // Remove last two moves (AI + player)
    const newHistory = moveHistory.slice(0, -2);
    const newBoardHistory = boardHistory.current.slice(0, -2);
    const newTurnHistory = turnHistory.current.slice(0, -2);

    const previousBoard = newBoardHistory[newBoardHistory.length - 1];
    const previousTurn = newTurnHistory[newTurnHistory.length - 1];

    setBoard(previousBoard);
    setCurrentTurn(previousTurn);
    setMoveHistory(newHistory);
    moveHistoryRef.current = newHistory.map(m => ({ from: m.from, to: m.to }));
    setSelectedPosition(null);
    setValidMoves([]);
    setStatus('playing');
    setCheckState(isInCheck(previousBoard, previousTurn));
    setAiExplanation('');
    setAiSearchDepth(null);
    setAiScore(null);
    setLastMove(newHistory.length > 0 ? { from: newHistory[newHistory.length - 1].from, to: newHistory[newHistory.length - 1].to } : null);
    setAiThinkingProgress(null);

    boardHistory.current = newBoardHistory;
    turnHistory.current = newTurnHistory;

    // Recalculate captured pieces
    const newCaptured: { red: Piece[]; black: Piece[] } = { red: [], black: [] };
    for (const move of newHistory) {
      if (move.captured) {
        newCaptured[move.piece.color].push(move.captured);
      }
    }
    setCapturedPieces(newCaptured);
  }, [moveHistory, aiThinking]);

  const toggleAiExplanation = useCallback(() => {
    setAiExplanationEnabled(prev => !prev);
  }, []);

  const toggleSound = useCallback(() => {
    setSoundEnabled(prev => !prev);
  }, []);

  const changeDifficulty = useCallback((d: Difficulty) => {
    setDifficulty(d);
  }, []);

  return {
    board,
    currentTurn,
    selectedPosition,
    validMoves,
    moveHistory,
    capturedPieces,
    status,
    isInCheck: checkState,
    difficulty,
    aiThinking,
    aiExplanation,
    aiExplanationEnabled,
    aiExplanationLoading,
    aiSearchDepth,
    aiScore,
    lastMove,
    soundEnabled,
    aiThinkingProgress,
    handleCellClick,
    newGame,
    undoMove,
    toggleAiExplanation,
    toggleSound,
    changeDifficulty,
    setDifficulty: changeDifficulty,
  };
}
