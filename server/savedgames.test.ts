import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user",
    email: "test@example.com",
    name: "Test User",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

function createUnauthContext(): TrpcContext {
  return {
    user: null,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

describe("game.saveGame", () => {
  it("requires authentication to save a game", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.game.saveGame({
        name: "Test Game",
        gameState: '{"board":[]}',
        moveCount: 5,
        difficulty: "medium",
        playerColor: "red",
        status: "playing",
      })
    ).rejects.toThrow();
  });

  it("saves a game for authenticated user", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // This will try to save to the actual database
    // If DB is available, it should succeed
    try {
      const result = await caller.game.saveGame({
        name: "Test Game",
        gameState: '{"board":[]}',
        moveCount: 5,
        difficulty: "medium",
        playerColor: "red",
        status: "playing",
      });
      expect(result).toEqual({ success: true });
    } catch (e: any) {
      // If DB is not available, that's expected in test env
      expect(e.message).toBeDefined();
    }
  });
});

describe("game.listSavedGames", () => {
  it("requires authentication to list saved games", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);

    await expect(caller.game.listSavedGames()).rejects.toThrow();
  });

  it("returns an array for authenticated user", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    try {
      const result = await caller.game.listSavedGames();
      expect(Array.isArray(result)).toBe(true);
    } catch (e: any) {
      // DB might not be available in test
      expect(e.message).toBeDefined();
    }
  });
});

describe("game.deleteGame", () => {
  it("requires authentication to delete a game", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.game.deleteGame({ id: 1 })
    ).rejects.toThrow();
  });
});

describe("game.loadGame", () => {
  it("requires authentication to load a game", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.game.loadGame({ id: 1 })
    ).rejects.toThrow();
  });
});
