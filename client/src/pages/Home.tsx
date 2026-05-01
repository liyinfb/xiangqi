import { useGameState } from '@/hooks/useGameState';
import XiangqiBoard from '@/components/XiangqiBoard';
import GameInfoPanel from '@/components/GameInfoPanel';

export default function Home() {
  const game = useGameState();

  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-100 via-amber-50 to-stone-100">
      {/* Header */}
      <header className="border-b border-stone-200 bg-white/80 backdrop-blur-sm">
        <div className="container py-4">
          <div className="flex items-center justify-center gap-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-red-700 to-red-900 flex items-center justify-center">
              <span className="text-white text-sm font-bold">棋</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-stone-800" style={{ fontFamily: '"Noto Serif SC", serif' }}>
              Chinese Chess
            </h1>
            <span className="text-sm text-stone-500 font-medium">象棋</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container py-8">
        <div className="flex flex-col lg:flex-row items-start justify-center gap-8 max-w-6xl mx-auto">
          {/* Board Section */}
          <div className="flex-shrink-0 w-full lg:w-auto">
            <div className="bg-white rounded-xl shadow-lg p-4 border border-stone-200">
              <XiangqiBoard
                board={game.board}
                selectedPosition={game.selectedPosition}
                validMoves={game.validMoves}
                lastMove={game.lastMove}
                onCellClick={game.handleCellClick}
                currentTurn={game.currentTurn}
                disabled={game.status !== 'playing' || game.currentTurn !== 'red' || game.aiThinking}
              />
            </div>
          </div>

          {/* Info Panel */}
          <div className="w-full lg:w-auto">
            <GameInfoPanel
              moveHistory={game.moveHistory}
              capturedPieces={game.capturedPieces}
              status={game.status}
              currentTurn={game.currentTurn}
              isInCheck={game.isInCheck}
              difficulty={game.difficulty}
              aiThinking={game.aiThinking}
              aiExplanation={game.aiExplanation}
              aiExplanationEnabled={game.aiExplanationEnabled}
              aiExplanationLoading={game.aiExplanationLoading}
              onNewGame={game.newGame}
              onUndo={game.undoMove}
              onToggleExplanation={game.toggleAiExplanation}
              onChangeDifficulty={game.changeDifficulty}
            />
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-stone-200 bg-white/60 py-4 mt-8">
        <div className="container text-center text-sm text-stone-500">
          Play as Red against the AI. Select a piece to see valid moves.
        </div>
      </footer>
    </div>
  );
}
