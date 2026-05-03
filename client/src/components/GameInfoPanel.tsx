import { useState } from 'react';
import { useAuth } from '@/_core/hooks/useAuth';
import { getLoginUrl } from '@/const';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Piece, PieceColor, Move, PIECE_CHARS, moveToNotation } from '@/lib/xiangqi';
import { Difficulty } from '@/lib/ai';
import { GameStatus, AIThinkingProgress, SearchStats } from '@/hooks/useGameState';
import SearchStatsPanel from '@/components/SearchStatsPanel';
import { trpc } from '@/lib/trpc';
import { RotateCcw, Plus, Undo2, Brain, Loader2, Trophy, Swords, Shield, Volume2, VolumeX, BookOpen, Zap, Save, FolderOpen, Trash2, LogIn, SkipBack, ChevronLeft, ChevronRight, SkipForward, Play } from 'lucide-react';
import { Streamdown } from 'streamdown';
import { toast } from 'sonner';

interface GameInfoPanelProps {
  moveHistory: Move[];
  capturedPieces: { red: Piece[]; black: Piece[] };
  status: GameStatus;
  currentTurn: PieceColor;
  playerColor: PieceColor;
  isInCheck: boolean;
  difficulty: Difficulty;
  aiThinking: boolean;
  aiExplanation: string;
  aiExplanationEnabled: boolean;
  aiExplanationLoading: boolean;
  aiSearchDepth: number | null;
  aiScore: number | null;
  soundEnabled: boolean;
  aiThinkingProgress: AIThinkingProgress | null;
  onNewGame: (color?: PieceColor) => void;
  onUndo: () => void;
  onToggleExplanation: () => void;
  onToggleSound: () => void;
  onChangeDifficulty: (d: Difficulty) => void;
  serializeGameState: () => string;
  loadGameState: (serialized: string) => boolean;
  searchStatsHistory: SearchStats[];
  // Replay props
  replayIndex: number | null;
  totalMoves: number;
  onReplayGoTo: (index: number) => void;
  onReplayGoFirst: () => void;
  onReplayGoPrev: () => void;
  onReplayGoNext: () => void;
  onReplayGoLast: () => void;
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
  playerColor,
  isInCheck,
  difficulty,
  aiThinking,
  aiExplanation,
  aiExplanationEnabled,
  aiExplanationLoading,
  aiSearchDepth,
  aiScore,
  soundEnabled,
  aiThinkingProgress,
  onNewGame,
  onUndo,
  onToggleExplanation,
  onToggleSound,
  onChangeDifficulty,
  serializeGameState,
  loadGameState,
  searchStatsHistory,
  replayIndex,
  totalMoves,
  onReplayGoTo,
  onReplayGoFirst,
  onReplayGoPrev,
  onReplayGoNext,
  onReplayGoLast,
}: GameInfoPanelProps) {
  const { user, isAuthenticated } = useAuth();
  const [loadDialogOpen, setLoadDialogOpen] = useState(false);
  const [saveName, setSaveName] = useState('');

  const isPlayerTurn = currentTurn === playerColor;
  const aiColorLabel = playerColor === 'red' ? '黑方' : '红方';
  const playerColorLabel = playerColor === 'red' ? '红方' : '黑方';

  // tRPC queries for save/load
  const savedGamesQuery = trpc.game.listSavedGames.useQuery(undefined, {
    enabled: isAuthenticated && loadDialogOpen,
  });
  const saveGameMutation = trpc.game.saveGame.useMutation({
    onSuccess: () => {
      toast.success('对局已保存');
      setSaveName('');
    },
    onError: () => toast.error('保存失败，请重试'),
  });
  const loadGameMutation = trpc.game.loadGame.useMutation({
    onSuccess: (data) => {
      if (data && loadGameState(data.gameState)) {
        toast.success('对局已加载');
        setLoadDialogOpen(false);
      } else {
        toast.error('加载失败，存档可能已损坏');
      }
    },
    onError: () => toast.error('加载失败，请重试'),
  });
  const deleteGameMutation = trpc.game.deleteGame.useMutation({
    onSuccess: () => {
      toast.success('存档已删除');
      savedGamesQuery.refetch();
    },
    onError: () => toast.error('删除失败'),
  });

  const getStatusText = () => {
    switch (status) {
      case 'red_wins': return playerColor === 'red' ? '🏆 您赢了！' : '😔 电脑赢了';
      case 'black_wins': return playerColor === 'black' ? '🏆 您赢了！' : '😔 电脑赢了';
      case 'stalemate': return '🤝 和棋';
      default:
        if (aiThinking) return '🤔 电脑思考中...';
        if (isInCheck) return '⚠️ 将军！';
        return isPlayerTurn ? `🔵 轮到您走（${playerColorLabel}）` : `⚫ 电脑走棋中`;
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'red_wins': return playerColor === 'red' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800';
      case 'black_wins': return playerColor === 'black' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800';
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

  const getTimeLimit = () => {
    switch (difficulty) {
      case 'easy': return 2000;
      case 'medium': return 5000;
      case 'hard': return 8000;
    }
  };

  const handleSaveGame = () => {
    if (!isAuthenticated) {
      toast.error('请先登录后再保存对局');
      return;
    }
    const name = saveName.trim() || `对局 ${new Date().toLocaleString('zh-CN')}`;
    const gameState = serializeGameState();
    saveGameMutation.mutate({
      name,
      gameState,
      moveCount: moveHistory.length,
      difficulty,
      playerColor,
      status,
    });
  };

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

      {/* AI Thinking Progress */}
      {aiThinking && aiThinkingProgress && (
        <Card className="border-blue-200 bg-blue-50/50">
          <CardContent className="py-3 px-4 space-y-2">
            {aiThinkingProgress.isFromBook ? (
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-blue-600 animate-pulse" />
                <span className="text-sm font-medium text-blue-800">
                  开局库：{aiThinkingProgress.openingName || '查找中...'}
                </span>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-blue-600 animate-pulse" />
                    <span className="text-sm font-medium text-blue-800">
                      搜索深度：{aiThinkingProgress.currentDepth} 层
                    </span>
                  </div>
                  <span className="text-xs text-blue-600">
                    {(aiThinkingProgress.timeElapsed / 1000).toFixed(1)}s
                  </span>
                </div>
                {aiThinkingProgress.nodesSearched !== undefined && aiThinkingProgress.nodesSearched > 0 && (
                  <div className="text-xs text-blue-600">
                    已搜索 {aiThinkingProgress.nodesSearched.toLocaleString()} 个节点
                    {aiThinkingProgress.timeElapsed > 0 && (
                      <span className="ml-2">
                        ({Math.round(aiThinkingProgress.nodesSearched / (aiThinkingProgress.timeElapsed / 1000)).toLocaleString()} 节点/秒)
                      </span>
                    )}
                  </div>
                )}
                <Progress 
                  value={Math.min((aiThinkingProgress.timeElapsed / getTimeLimit()) * 100, 95)} 
                  className="h-2"
                />
              </>
            )}
          </CardContent>
        </Card>
      )}

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

          {/* Player Color Selection */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground tracking-wider">执子选择（开新局生效）</label>
            <div className="flex gap-2">
              <Button
                variant={playerColor === 'red' ? 'default' : 'outline'}
                size="sm"
                className="flex-1"
                onClick={() => onNewGame('red')}
              >
                <span className="text-red-500 mr-1">●</span> 执红先行
              </Button>
              <Button
                variant={playerColor === 'black' ? 'default' : 'outline'}
                size="sm"
                className="flex-1"
                onClick={() => onNewGame('black')}
              >
                <span className="mr-1">●</span> 执黑后行
              </Button>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            <Button onClick={() => onNewGame()} variant="outline" size="sm" className="flex-1">
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

          {/* Save/Load Buttons */}
          <div className="flex gap-2">
            {isAuthenticated ? (
              <>
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm" className="flex-1" disabled={moveHistory.length === 0}>
                      <Save className="w-4 h-4 mr-1" />
                      保存
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                      <DialogTitle>保存对局</DialogTitle>
                      <DialogDescription>为当前对局命名并保存，以便日后继续。</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <input
                        type="text"
                        placeholder="输入存档名称（可选）"
                        value={saveName}
                        onChange={e => setSaveName(e.target.value)}
                        className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <div className="text-xs text-muted-foreground">
                        当前：{playerColorLabel} · {DIFFICULTY_LABELS[difficulty]} · 第 {moveHistory.length} 步
                      </div>
                      <Button
                        onClick={handleSaveGame}
                        className="w-full"
                        disabled={saveGameMutation.isPending}
                      >
                        {saveGameMutation.isPending ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <Save className="w-4 h-4 mr-2" />
                        )}
                        保存对局
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>

                <Dialog open={loadDialogOpen} onOpenChange={setLoadDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm" className="flex-1">
                      <FolderOpen className="w-4 h-4 mr-1" />
                      加载
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                      <DialogTitle>加载对局</DialogTitle>
                      <DialogDescription>选择一个已保存的对局继续。</DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                      {savedGamesQuery.isLoading ? (
                        <div className="flex items-center justify-center py-8">
                          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                        </div>
                      ) : !savedGamesQuery.data || savedGamesQuery.data.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-8">暂无保存的对局</p>
                      ) : (
                        <ScrollArea className="h-[300px]">
                          <div className="space-y-2">
                            {savedGamesQuery.data.map((game: any) => (
                              <div
                                key={game.id}
                                className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                              >
                                <div
                                  className="flex-1 cursor-pointer"
                                  onClick={() => loadGameMutation.mutate({ id: game.id })}
                                >
                                  <div className="text-sm font-medium">{game.name}</div>
                                  <div className="text-xs text-muted-foreground mt-1">
                                    {game.playerColor === 'red' ? '执红' : '执黑'} · {DIFFICULTY_LABELS[game.difficulty as Difficulty] || game.difficulty} · 第 {game.moveCount} 步
                                    {game.status !== 'playing' && (
                                      <span className="ml-1">
                                        · {game.status === 'red_wins' ? '红胜' : game.status === 'black_wins' ? '黑胜' : '和棋'}
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    {new Date(game.createdAt).toLocaleString('zh-CN')}
                                  </div>
                                </div>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    deleteGameMutation.mutate({ id: game.id });
                                  }}
                                  className="text-rose-500 hover:text-rose-700 hover:bg-rose-50"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        </ScrollArea>
                      )}
                    </div>
                  </DialogContent>
                </Dialog>
              </>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => window.location.href = getLoginUrl()}
              >
                <LogIn className="w-4 h-4 mr-1" />
                登录以保存/加载对局
              </Button>
            )}
          </div>

          {/* Toggles */}
          <div className="space-y-2">
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

            {/* Sound Toggle */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <div className="flex items-center gap-2">
                {soundEnabled ? (
                  <Volume2 className="w-4 h-4 text-blue-600" />
                ) : (
                  <VolumeX className="w-4 h-4 text-gray-400" />
                )}
                <span className="text-sm font-medium">音效</span>
              </div>
              <Switch
                checked={soundEnabled}
                onCheckedChange={onToggleSound}
              />
            </div>
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
          <CardContent className="space-y-3">
            {/* Search depth info badge */}
            {aiSearchDepth !== null && (
              <div className="flex items-center gap-2 flex-wrap">
                {aiSearchDepth === 0 ? (
                  <Badge variant="outline" className="text-xs bg-green-100 text-green-700 border-green-300">
                    <BookOpen className="w-3 h-3 mr-1" />
                    开局库走法
                  </Badge>
                ) : (
                  <>
                    <Badge variant="outline" className="text-xs bg-purple-100 text-purple-700 border-purple-300">
                      搜索深度：{aiSearchDepth} 层
                    </Badge>
                    {aiScore !== null && (
                      <Badge variant="outline" className="text-xs bg-purple-100 text-purple-700 border-purple-300">
                        评估分数：{aiScore > 0 ? '+' : ''}{aiScore}
                      </Badge>
                    )}
                  </>
                )}
              </div>
            )}

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
                电脑走棋后将在此显示策略分析
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Search Statistics */}
      <SearchStatsPanel stats={searchStatsHistory} isThinking={aiThinking} />

      {/* Captured Pieces */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Shield className="w-4 h-4" />
            被吃棋子
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {renderCapturedPieces(
            capturedPieces[playerColor],
            `${playerColorLabel}（您）吃掉的`
          )}
          <Separator />
          {renderCapturedPieces(
            capturedPieces[playerColor === 'red' ? 'black' : 'red'],
            `${aiColorLabel}（电脑）吃掉的`
          )}
        </CardContent>
      </Card>

      {/* Move History */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center justify-between">
            <div className="flex items-center gap-2">
              <RotateCcw className="w-4 h-4" />
              走棋记录
            </div>
            {moveHistory.length > 0 && (
              <span className="text-xs font-normal text-muted-foreground">
                共 {moveHistory.length} 步
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Replay Navigation Controls */}
          {moveHistory.length > 0 && (
            <div className="flex items-center justify-center gap-1">
              <Button
                variant="outline"
                size="icon-sm"
                onClick={onReplayGoFirst}
                disabled={replayIndex === 0}
                title="跳到开局"
              >
                <SkipBack className="w-3.5 h-3.5" />
              </Button>
              <Button
                variant="outline"
                size="icon-sm"
                onClick={onReplayGoPrev}
                disabled={replayIndex === 0}
                title="上一步"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </Button>
              <span className="text-xs text-muted-foreground min-w-[60px] text-center">
                {replayIndex !== null ? `${replayIndex} / ${totalMoves}` : '实时'}
              </span>
              <Button
                variant="outline"
                size="icon-sm"
                onClick={onReplayGoNext}
                disabled={replayIndex === null}
                title="下一步"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </Button>
              <Button
                variant="outline"
                size="icon-sm"
                onClick={onReplayGoLast}
                disabled={replayIndex === null}
                title="回到实时"
              >
                <SkipForward className="w-3.5 h-3.5" />
              </Button>
            </div>
          )}

          {/* Move List */}
          <ScrollArea className="h-[200px]">
            {moveHistory.length === 0 ? (
              <p className="text-sm text-muted-foreground italic text-center py-4">
                尚无走棋记录，{playerColor === 'red' ? '请点击红色棋子开始' : '等待电脑先行'}
              </p>
            ) : (
              <div className="space-y-1">
                {moveHistory.map((move, idx) => {
                  const moveStep = idx + 1;
                  const isActive = replayIndex !== null && replayIndex === moveStep;
                  const isLatest = replayIndex === null && idx === moveHistory.length - 1;
                  return (
                    <div
                      key={idx}
                      onClick={() => onReplayGoTo(moveStep)}
                      className={`flex items-center gap-2 text-sm py-1 px-2 rounded cursor-pointer transition-colors ${
                        isActive
                          ? 'bg-blue-100 border border-blue-300 font-medium'
                          : isLatest
                          ? 'bg-amber-50 font-medium hover:bg-amber-100'
                          : 'hover:bg-muted/50'
                      }`}
                    >
                      <Badge
                        variant="outline"
                        className={`text-xs min-w-[28px] justify-center ${
                          isActive ? 'bg-blue-200 border-blue-400 text-blue-800' : ''
                        }`}
                      >
                        {moveStep}
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
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
