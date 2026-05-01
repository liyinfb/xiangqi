import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Piece, PieceColor, Move, PIECE_CHARS, moveToNotation } from '@/lib/xiangqi';
import { Difficulty } from '@/lib/ai';
import { GameStatus } from '@/hooks/useGameState';
import { RotateCcw, Plus, Undo2, Brain, Loader2, Trophy, Swords, Shield } from 'lucide-react';
import { Streamdown } from 'streamdown';

interface GameInfoPanelProps {
  moveHistory: Move[];
  capturedPieces: { red: Piece[]; black: Piece[] };
  status: GameStatus;
  currentTurn: PieceColor;
  isInCheck: boolean;
  difficulty: Difficulty;
  aiThinking: boolean;
  aiExplanation: string;
  aiExplanationEnabled: boolean;
  aiExplanationLoading: boolean;
  onNewGame: () => void;
  onUndo: () => void;
  onToggleExplanation: () => void;
  onChangeDifficulty: (d: Difficulty) => void;
}

const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  easy: '简单',
  medium: '中等',
  hard: '困难',
};

export default function GameInfoPanel({
  moveHistory,
  capturedPieces,
  status,
  currentTurn,
  isInCheck,
  difficulty,
  aiThinking,
  aiExplanation,
  aiExplanationEnabled,
  aiExplanationLoading,
  onNewGame,
  onUndo,
  onToggleExplanation,
  onChangeDifficulty,
}: GameInfoPanelProps) {
  const getStatusText = () => {
    switch (status) {
      case 'red_wins': return '🏆 红方胜！';
      case 'black_wins': return '🏆 黑方胜！';
      case 'stalemate': return '🤝 和棋';
      default:
        if (aiThinking) return '🤔 AI 思考中...';
        if (isInCheck) return '⚠️ 将军！';
        return currentTurn === 'red' ? '🔴 轮到您走' : '⚫ AI 走棋中';
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'red_wins': return 'bg-emerald-50 border-emerald-200 text-emerald-800';
      case 'black_wins': return 'bg-rose-50 border-rose-200 text-rose-800';
      case 'stalemate': return 'bg-amber-50 border-amber-200 text-amber-800';
      default:
        if (isInCheck) return 'bg-orange-50 border-orange-200 text-orange-800';
        return 'bg-sky-50 border-sky-200 text-sky-800';
    }
  };

  const renderCapturedPieces = (pieces: Piece[], label: string) => (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium text-muted-foreground tracking-wider">{label}</span>
      <div className="flex flex-wrap gap-1 min-h-[28px]">
        {pieces.length === 0 ? (
          <span className="text-xs text-muted-foreground italic">暂无</span>
        ) : (
          pieces.map((piece, idx) => (
            <span
              key={idx}
              className={`text-lg leading-none ${piece.color === 'red' ? 'text-red-700' : 'text-slate-800'}`}
              title={piece.type}
            >
              {PIECE_CHARS[piece.color][piece.type]}
            </span>
          ))
        )}
      </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-4 w-full max-w-sm">
      {/* Game Status */}
      <Card className={`border-2 ${getStatusColor()}`}>
        <CardContent className="py-4 px-5">
          <div className="text-center font-semibold text-lg">
            {getStatusText()}
          </div>
        </CardContent>
      </Card>

      {/* Game Controls */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Swords className="w-4 h-4" />
            游戏控制
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Difficulty */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground tracking-wider">难度选择</label>
            <div className="flex gap-2">
              {(['easy', 'medium', 'hard'] as Difficulty[]).map(d => (
                <Button
                  key={d}
                  variant={difficulty === d ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => onChangeDifficulty(d)}
                  className="flex-1"
                >
                  {DIFFICULTY_LABELS[d]}
                </Button>
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            <Button onClick={onNewGame} variant="outline" size="sm" className="flex-1">
              <Plus className="w-4 h-4 mr-1" />
              新局
            </Button>
            <Button
              onClick={onUndo}
              variant="outline"
              size="sm"
              className="flex-1"
              disabled={moveHistory.length < 2 || aiThinking}
            >
              <Undo2 className="w-4 h-4 mr-1" />
              悔棋
            </Button>
          </div>

          {/* AI Explanation Toggle */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
            <div className="flex items-center gap-2">
              <Brain className="w-4 h-4 text-purple-600" />
              <span className="text-sm font-medium">AI 解说</span>
            </div>
            <Switch
              checked={aiExplanationEnabled}
              onCheckedChange={onToggleExplanation}
            />
          </div>
        </CardContent>
      </Card>

      {/* AI Explanation */}
      {aiExplanationEnabled && (
        <Card className="border-purple-200 bg-purple-50/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2 text-purple-800">
              <Brain className="w-4 h-4" />
              AI 走棋解说
            </CardTitle>
          </CardHeader>
          <CardContent>
            {aiExplanationLoading ? (
              <div className="flex items-center gap-2 text-sm text-purple-600">
                <Loader2 className="w-4 h-4 animate-spin" />
                正在分析走法...
              </div>
            ) : aiExplanation ? (
              <div className="text-sm text-purple-900 leading-relaxed prose prose-sm prose-purple max-w-none">
                <Streamdown>{aiExplanation}</Streamdown>
              </div>
            ) : (
              <p className="text-sm text-purple-600 italic">
                AI 走棋后将在此显示策略分析
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Captured Pieces */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Shield className="w-4 h-4" />
            被吃棋子
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {renderCapturedPieces(capturedPieces.red, '红方（您）吃掉的')}
          <Separator />
          {renderCapturedPieces(capturedPieces.black, '黑方（AI）吃掉的')}
        </CardContent>
      </Card>

      {/* Move History */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <RotateCcw className="w-4 h-4" />
            走棋记录
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[200px]">
            {moveHistory.length === 0 ? (
              <p className="text-sm text-muted-foreground italic text-center py-4">
                尚无走棋记录，请点击红色棋子开始
              </p>
            ) : (
              <div className="space-y-1">
                {moveHistory.map((move, idx) => (
                  <div
                    key={idx}
                    className={`flex items-center gap-2 text-sm py-1 px-2 rounded ${
                      idx === moveHistory.length - 1 ? 'bg-amber-50 font-medium' : ''
                    }`}
                  >
                    <Badge variant="outline" className="text-xs min-w-[28px] justify-center">
                      {idx + 1}
                    </Badge>
                    <span className={`font-medium ${move.piece.color === 'red' ? 'text-red-700' : 'text-slate-800'}`}>
                      {PIECE_CHARS[move.piece.color][move.piece.type]}
                    </span>
                    <span className="text-muted-foreground text-xs">
                      {moveToNotation(move)}
                    </span>
                    {move.captured && (
                      <span className="text-xs text-rose-600">
                        吃{PIECE_CHARS[move.captured.color][move.captured.type]}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
