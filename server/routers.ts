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
      .input(z.object({ context: z.string() }))
      .mutation(async ({ input }) => {
        try {
          const response = await invokeLLM({
            messages: [
              {
                role: "system",
                content: `你是一位资深的中国象棋评论员和战略分析师。当收到一步棋的描述时，请用中文提供简洁而有深度的策略分析。请考虑以下方面：
- 战术威胁（吃子、捉双、牵制、闪击）
- 位置优势（控制要道、占据要点、将帅安全）
- 战略规划（子力协调、兵卒推进、攻防平衡）
- 常见象棋棋理和布局套路

请用2-3句话解释，语言生动且具有教育意义。使用标准象棋术语。`,
              },
              {
                role: "user",
                content: `请分析这步象棋走法的策略意图：\n\n${input.context}`,
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
