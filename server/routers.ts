import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { invokeLLM } from "./_core/llm";
import { z } from "zod";
import { getDb } from "./db";
import { savedGames } from "../drizzle/schema";
import { eq, and, desc } from "drizzle-orm";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  game: router({
    explainMove: publicProcedure
      .input(z.object({
        context: z.string(),
        searchDepth: z.number(),
        score: z.number(),
        difficulty: z.string(),
        nodesSearched: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        try {
          const response = await invokeLLM({
            messages: [
              {
                role: "system",
                content: `你是一位资深的中国象棋评论员和战略分析师。你需要解说电脑AI的走棋决策。

解说要求：
1. 首先简要说明AI搜索的深度和评估情况（用通俗易懂的方式）
2. 然后解释为什么电脑选择了这步棋，分析其战略意图
3. 如果有吃子或将军，重点说明这步棋的战术价值

请考虑以下方面：
- 战术威胁（吃子、捉双、牵制、闪击）
- 位置优势（控制要道、占据要点、将帅安全）
- 战略规划（子力协调、兵卒推进、攻防平衡）
- 常见象棋棋理和布局套路

请用中文回答，3-4句话，语言生动且具有教育意义。使用标准象棋术语。`,
              },
              {
                role: "user",
                content: `电脑AI（难度：${input.difficulty}）经过${input.searchDepth}层深度搜索后选择了这步棋，评估分数为${input.score}分。

走法详情：
${input.context}

请解释电脑为什么选择这步棋，以及搜索深度对决策的影响。`,
              },
            ],
          });

          const explanation = response.choices?.[0]?.message?.content || "无法生成解说。";
          return explanation;
        } catch (error) {
          console.error("LLM explanation error:", error);
          return "暂时无法生成解说，请稍后再试。";
        }
      }),

    // Save a game
    saveGame: protectedProcedure
      .input(z.object({
        name: z.string().min(1).max(255),
        gameState: z.string(),
        moveCount: z.number(),
        difficulty: z.string(),
        playerColor: z.string(),
        status: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("数据库不可用");

        await db.insert(savedGames).values({
          userId: ctx.user.id,
          name: input.name,
          gameState: input.gameState,
          moveCount: input.moveCount,
          difficulty: input.difficulty,
          playerColor: input.playerColor,
          status: input.status,
        });

        return { success: true };
      }),

    // List saved games for current user
    listSavedGames: protectedProcedure
      .query(async ({ ctx }) => {
        const db = await getDb();
        if (!db) return [];

        const games = await db
          .select()
          .from(savedGames)
          .where(eq(savedGames.userId, ctx.user.id))
          .orderBy(desc(savedGames.updatedAt))
          .limit(20);

        return games;
      }),

    // Load a specific saved game
    loadGame: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("数据库不可用");

        const results = await db
          .select()
          .from(savedGames)
          .where(and(
            eq(savedGames.id, input.id),
            eq(savedGames.userId, ctx.user.id),
          ))
          .limit(1);

        if (results.length === 0) throw new Error("存档不存在");

        return results[0];
      }),

    // Delete a saved game
    deleteGame: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("数据库不可用");

        await db
          .delete(savedGames)
          .where(and(
            eq(savedGames.id, input.id),
            eq(savedGames.userId, ctx.user.id),
          ));

        return { success: true };
      }),
  }),
});

export type AppRouter = typeof appRouter;
