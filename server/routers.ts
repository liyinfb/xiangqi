import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { invokeLLM } from "./_core/llm";
import { z } from "zod";

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
  }),
});

export type AppRouter = typeof appRouter;
