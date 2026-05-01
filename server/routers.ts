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
                content: `You are an expert Chinese Chess (Xiangqi) commentator and strategist. When given a move description, provide a concise but insightful explanation of the strategic reasoning behind the move. Consider:
- Tactical threats (captures, forks, pins, discovered attacks)
- Positional advantages (controlling key files, outposts, king safety)
- Strategic plans (piece coordination, pawn advancement, attack/defense balance)
- Common Xiangqi principles and patterns

Keep your explanation to 2-3 sentences, written in an engaging and educational tone. Use standard Xiangqi terminology where appropriate.`,
              },
              {
                role: "user",
                content: `Please explain the strategic reasoning behind this Chinese Chess move:\n\n${input.context}`,
              },
            ],
          });

          const explanation = response.choices?.[0]?.message?.content || "Unable to generate explanation.";
          return explanation;
        } catch (error) {
          console.error("LLM explanation error:", error);
          return "Unable to generate explanation at this time.";
        }
      }),
  }),
});

export type AppRouter = typeof appRouter;
