import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { SearchStats } from '@/hooks/useGameState';
import { BarChart3, ChevronDown, ChevronUp, TrendingUp, TrendingDown, Minus, BookOpen, Zap, Activity, Timer, Cpu, Hash } from 'lucide-react';

interface SearchStatsPanelProps {
  stats: SearchStats[];
  isThinking: boolean;
}

function formatNumber(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return n.toString();
}

function formatTime(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function ScoreBadge({ score, isFromBook }: { score: number; isFromBook: boolean }) {
  if (isFromBook) {
    return (
      <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-300 font-mono">
        <BookOpen className="w-3 h-3 mr-0.5" />
        开局库
      </Badge>
    );
  }
  const color = score > 50 ? 'text-emerald-700 bg-emerald-50 border-emerald-300'
    : score < -50 ? 'text-rose-700 bg-rose-50 border-rose-300'
    : 'text-slate-700 bg-slate-50 border-slate-300';
  return (
    <Badge variant="outline" className={`text-xs font-mono ${color}`}>
      {score > 0 ? '+' : ''}{score}
    </Badge>
  );
}

function TrendIndicator({ current, previous }: { current: number; previous?: number }) {
  if (previous === undefined) return null;
  const diff = current - previous;
  if (diff > 0) return <TrendingUp className="w-3 h-3 text-emerald-500" />;
  if (diff < 0) return <TrendingDown className="w-3 h-3 text-rose-500" />;
  return <Minus className="w-3 h-3 text-slate-400" />;
}

export default function SearchStatsPanel({ stats, isThinking }: SearchStatsPanelProps) {
  const [expanded, setExpanded] = useState(false);

  const summary = useMemo(() => {
    if (stats.length === 0) return null;
    const searchStats = stats.filter(s => !s.isFromBook);
    if (searchStats.length === 0) return { avgDepth: 0, avgNps: 0, avgTime: 0, totalNodes: 0, bookMoves: stats.length, searchMoves: 0 };
    
    const avgDepth = searchStats.reduce((s, x) => s + x.depth, 0) / searchStats.length;
    const avgNps = searchStats.reduce((s, x) => s + x.nps, 0) / searchStats.length;
    const avgTime = searchStats.reduce((s, x) => s + x.timeMs, 0) / searchStats.length;
    const totalNodes = searchStats.reduce((s, x) => s + x.nodes, 0);
    const maxDepth = Math.max(...searchStats.map(s => s.depth));
    const maxNps = Math.max(...searchStats.map(s => s.nps));
    
    return {
      avgDepth: Math.round(avgDepth * 10) / 10,
      avgNps: Math.round(avgNps),
      avgTime: Math.round(avgTime),
      totalNodes,
      maxDepth,
      maxNps,
      bookMoves: stats.length - searchStats.length,
      searchMoves: searchStats.length,
    };
  }, [stats]);

  const lastStat = stats.length > 0 ? stats[stats.length - 1] : null;
  const prevStat = stats.length > 1 ? stats[stats.length - 2] : undefined;

  if (stats.length === 0) {
    return (
      <Card className="border-slate-200 bg-slate-50/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2 text-slate-700">
            <BarChart3 className="w-4 h-4" />
            搜索统计
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground italic text-center py-2">
            电脑走棋后将在此显示搜索统计
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-slate-200 bg-slate-50/50">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold flex items-center justify-between text-slate-700">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4" />
            搜索统计
            {isThinking && (
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500" />
              </span>
            )}
          </div>
          <span className="text-xs font-normal text-muted-foreground">
            共 {stats.length} 步
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Latest Move Stats */}
        {lastStat && (
          <div className="space-y-2">
            <div className="text-xs font-medium text-muted-foreground tracking-wider">最近一步</div>
            <div className="grid grid-cols-3 gap-2">
              <div className="flex flex-col items-center p-2 rounded-lg bg-white border border-slate-200">
                <div className="flex items-center gap-1 text-xs text-muted-foreground mb-0.5">
                  <Zap className="w-3 h-3" />
                  深度
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-lg font-bold text-slate-800">
                    {lastStat.isFromBook ? '-' : lastStat.depth}
                  </span>
                  {!lastStat.isFromBook && prevStat && !prevStat.isFromBook && (
                    <TrendIndicator current={lastStat.depth} previous={prevStat.depth} />
                  )}
                </div>
                <span className="text-[10px] text-muted-foreground">层</span>
              </div>
              <div className="flex flex-col items-center p-2 rounded-lg bg-white border border-slate-200">
                <div className="flex items-center gap-1 text-xs text-muted-foreground mb-0.5">
                  <Hash className="w-3 h-3" />
                  节点
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-lg font-bold text-slate-800">
                    {lastStat.isFromBook ? '-' : formatNumber(lastStat.nodes)}
                  </span>
                </div>
                <span className="text-[10px] text-muted-foreground">个</span>
              </div>
              <div className="flex flex-col items-center p-2 rounded-lg bg-white border border-slate-200">
                <div className="flex items-center gap-1 text-xs text-muted-foreground mb-0.5">
                  <Timer className="w-3 h-3" />
                  耗时
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-lg font-bold text-slate-800">
                    {lastStat.isFromBook ? '-' : formatTime(lastStat.timeMs)}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Cpu className="w-3 h-3" />
                  NPS:
                </div>
                <span className="text-xs font-mono font-medium text-slate-700">
                  {lastStat.isFromBook ? '-' : formatNumber(lastStat.nps)}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-xs text-muted-foreground">评分:</span>
                <ScoreBadge score={lastStat.score} isFromBook={lastStat.isFromBook} />
              </div>
            </div>
          </div>
        )}

        {/* Summary Stats */}
        {summary && summary.searchMoves > 0 && (
          <div className="space-y-2">
            <div className="text-xs font-medium text-muted-foreground tracking-wider">全局统计</div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="flex items-center justify-between p-2 rounded-lg bg-white border border-slate-200">
                <span className="text-muted-foreground">平均深度</span>
                <span className="font-mono font-medium text-slate-700">{summary.avgDepth} 层</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-white border border-slate-200">
                <span className="text-muted-foreground">最大深度</span>
                <span className="font-mono font-medium text-slate-700">{summary.maxDepth} 层</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-white border border-slate-200">
                <span className="text-muted-foreground">平均 NPS</span>
                <span className="font-mono font-medium text-slate-700">{formatNumber(summary.avgNps)}</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-white border border-slate-200">
                <span className="text-muted-foreground">总节点数</span>
                <span className="font-mono font-medium text-slate-700">{formatNumber(summary.totalNodes)}</span>
              </div>
            </div>
            {summary.bookMoves > 0 && (
              <div className="text-xs text-center text-muted-foreground">
                <BookOpen className="w-3 h-3 inline mr-1" />
                开局库走法 {summary.bookMoves} 步，搜索走法 {summary.searchMoves} 步
              </div>
            )}
          </div>
        )}

        {/* Depth explanation note */}
        {summary && summary.searchMoves > 0 && (
          <p className="text-[10px] text-muted-foreground/70 text-center leading-relaxed px-2">
            搜索深度受局面复杂度、剩余棋子数和硬件速度影响，同一难度下不同局面深度可能差异较大
          </p>
        )}

        {/* Expandable History Table */}
        <div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded(!expanded)}
            className="w-full text-xs text-muted-foreground hover:text-slate-700"
          >
            {expanded ? <ChevronUp className="w-3 h-3 mr-1" /> : <ChevronDown className="w-3 h-3 mr-1" />}
            {expanded ? '收起历史' : '展开历史明细'}
          </Button>
          {expanded && (
            <ScrollArea className="h-[200px] mt-2">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs w-[36px]">#</TableHead>
                    <TableHead className="text-xs">深度</TableHead>
                    <TableHead className="text-xs">节点</TableHead>
                    <TableHead className="text-xs">耗时</TableHead>
                    <TableHead className="text-xs">NPS</TableHead>
                    <TableHead className="text-xs text-right">评分</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...stats].reverse().map((stat) => (
                    <TableRow key={stat.moveNumber} className="text-xs">
                      <TableCell className="font-mono py-1.5">{stat.moveNumber}</TableCell>
                      <TableCell className="font-mono py-1.5">
                        {stat.isFromBook ? (
                          <span className="text-green-600">📖</span>
                        ) : (
                          stat.depth
                        )}
                      </TableCell>
                      <TableCell className="font-mono py-1.5">
                        {stat.isFromBook ? '-' : formatNumber(stat.nodes)}
                      </TableCell>
                      <TableCell className="font-mono py-1.5">
                        {stat.isFromBook ? '-' : formatTime(stat.timeMs)}
                      </TableCell>
                      <TableCell className="font-mono py-1.5">
                        {stat.isFromBook ? '-' : formatNumber(stat.nps)}
                      </TableCell>
                      <TableCell className="font-mono py-1.5 text-right">
                        {stat.isFromBook ? (
                          <span className="text-green-600 text-[10px]">开局库</span>
                        ) : (
                          <span className={stat.score > 50 ? 'text-emerald-600' : stat.score < -50 ? 'text-rose-600' : ''}>
                            {stat.score > 0 ? '+' : ''}{stat.score}
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
