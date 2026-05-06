import { useGameState } from '@/hooks/useGameState';
import XiangqiBoard from '@/components/XiangqiBoard';
import GameInfoPanel from '@/components/GameInfoPanel';

export default function Home() {
  const game = useGameState();

  const isPlayerTurn = game.currentTurn === game.playerColor;
  const isReplaying = game.replayIndex !== null;

  // When replaying, show the historical board; otherwise show the live board
  const displayBoard = isReplaying && game.replayBoard ? game.replayBoard : game.board;
  const displayLastMove = isReplaying ? game.replayLastMove : game.lastMove;

  return (
    <div className="min-h-screen lg:h-screen lg:overflow-hidden bg-gradient-to-br from-stone-100 via-amber-50 to-stone-100 flex flex-col">
      {/* Header */}
      <header className="border-b border-stone-200 bg-white/80 backdrop-blur-sm flex-shrink-0">
        <div className="container py-3">
          <div className="flex items-center justify-center gap-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-red-700 to-red-900 flex items-center justify-center">
              <span className="text-white text-sm font-bold">棋</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-stone-800" style={{ fontFamily: '"Noto Serif SC", serif' }}>
              中国象棋
            </h1>
            <span className="text-sm text-stone-500 font-medium">人机对弈</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 lg:overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:h-full">
          {/* Board Section - fills left side on large screens */}
          <div className="flex-1 flex items-center justify-center p-4 lg:p-6">
            <div className={`bg-white rounded-xl shadow-lg p-4 border w-full max-w-[650px] lg:max-w-none ${isReplaying ? 'border-blue-300 ring-2 ring-blue-100' : 'border-stone-200'}`}>
              {isReplaying && (
                <div className="text-center text-sm text-blue-600 font-medium mb-2">
                  回放模式 · 第 {game.replayIndex} / {game.moveHistory.length} 步
                  <span className="text-xs text-blue-400 ml-2">（点击棋盘返回对弈）</span>
                </div>
              )}
              <XiangqiBoard
                board={displayBoard}
                selectedPosition={isReplaying ? null : game.selectedPosition}
                validMoves={isReplaying ? [] : game.validMoves}
                lastMove={displayLastMove}
                onCellClick={game.handleCellClick}
                currentTurn={game.currentTurn}
                playerColor={game.playerColor}
                disabled={!isReplaying && (game.status !== 'playing' || !isPlayerTurn || game.aiThinking)}
              />
            </div>
          </div>

          {/* Info Panel - independently scrollable on large screens */}
          <div className="w-full lg:w-[360px] xl:w-[400px] flex-shrink-0 lg:h-full lg:overflow-y-auto lg:border-l lg:border-stone-200 lg:bg-white/40 p-4 lg:p-5">
            <GameInfoPanel
              moveHistory={game.moveHistory}
              capturedPieces={game.capturedPieces}
              status={game.status}
              currentTurn={game.currentTurn}
              playerColor={game.playerColor}
              isInCheck={game.isInCheck}
              difficulty={game.difficulty}
              aiThinking={game.aiThinking}
              aiExplanation={game.aiExplanation}
              aiExplanationEnabled={game.aiExplanationEnabled}
              aiExplanationLoading={game.aiExplanationLoading}
              aiSearchDepth={game.aiSearchDepth}
              aiScore={game.aiScore}
              soundEnabled={game.soundEnabled}
              aiThinkingProgress={game.aiThinkingProgress}
              searchStatsHistory={game.searchStatsHistory}
              onNewGame={game.newGame}
              onUndo={game.undoMove}
              onToggleExplanation={game.toggleAiExplanation}
              onToggleSound={game.toggleSound}
              onChangeDifficulty={game.changeDifficulty}
              serializeGameState={game.serializeGameState}
              loadGameState={game.loadGameState}
              replayIndex={game.replayIndex}
              totalMoves={game.moveHistory.length}
              onReplayGoTo={game.replayGoTo}
              onReplayGoFirst={game.replayGoFirst}
              onReplayGoPrev={game.replayGoPrev}
              onReplayGoNext={game.replayGoNext}
              onReplayGoLast={game.replayGoLast}
            />
          </div>
        </div>
      </main>

      {/* Footer - hidden on large screens to maximize board space */}
      <footer className="border-t border-stone-200 bg-white/60 py-3 lg:hidden flex-shrink-0">
        <div className="container text-center text-sm text-stone-500">
          {game.playerColor === 'red' ? '您执红棋先行' : '您执黑棋，电脑先行'}，点击棋子查看可走位置
        </div>
      </footer>
    </div>
  );
}
