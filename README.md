# 中国象棋 (Chinese Chess / Xiangqi)

A full-featured Chinese Chess (Xiangqi) web application with a powerful AI opponent, built with React, TypeScript, and Express.

![Xiangqi Screenshot](screenshot.webp)

## Features

### Game Play

- **Interactive board** with traditional Chinese piece characters and valid move highlighting
- **Complete rule enforcement** for all 7 piece types (General, Advisor, Elephant, Horse, Chariot, Cannon, Soldier)
- **Check and checkmate detection** with proper turn management
- **Play as Red or Black** — board flips orientation when playing as Black
- **Undo moves** and start new games at any time
- **Sound effects** for moves, captures, checks, and game over (Web Audio API)

### AI Engine

The AI opponent uses a state-of-the-art alpha-beta search engine with the following techniques:

| Technique | Description |
|-----------|-------------|
| Iterative Deepening | Time-controlled search with aspiration windows |
| Principal Variation Search (PVS) | Tight null-window searches for non-PV nodes |
| Transposition Table | 4M-entry Zobrist hash table with age-based replacement |
| Null Move Pruning | Adaptive reduction (R = depth/4 + 3) |
| Late Move Reductions (LMR) | Aggressive reduction (0.65 factor) for late quiet moves |
| Late Move Pruning (LMP) | Skip quiet moves beyond threshold at shallow depths |
| Reverse Futility Pruning | Static eval cutoff at depth ≤ 8 |
| Futility Pruning | Margin-based pruning at depth ≤ 6 |
| Probcut | Shallow search prediction of fail-high at depth ≥ 7 |
| SEE (Static Exchange Evaluation) | Move ordering and bad capture pruning |
| Killer Moves & History Heuristic | Improved move ordering with counter-move bonus |
| Quiescence Search | Captures + SEE pruning to avoid horizon effect |
| Opening Book | 150+ entries covering 10 classic opening systems |
| Symmetry Optimization | Mirror-move deduplication on symmetric positions |

**Three difficulty levels** with distinct search budgets:

| Difficulty | Time Limit | Typical Depth (midgame) |
|------------|-----------|------------------------|
| Easy | 0.5 seconds | 6–8 |
| Medium | 3 seconds | 9–11 |
| Hard | 10 seconds | 12–15 |

### Additional Features

- **AI move explanations** — LLM-powered natural language commentary (optional toggle)
- **Search statistics panel** — real-time depth, nodes, NPS, evaluation score per move
- **Save/Load games** — persist game state to database (requires login)
- **Step-by-step replay** — review saved game history move by move
- **AI thinking progress** — live depth/nodes/NPS display during computation
- **Web Worker** — AI runs in a background thread for non-blocking UI

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, TypeScript, Tailwind CSS 4, shadcn/ui |
| Backend | Express 4, tRPC 11, Drizzle ORM |
| Database | MySQL 8 (TiDB compatible) |
| Auth | Manus OAuth (optional for local dev) |
| Build | Vite 7, esbuild, pnpm |

## Getting Started

### Prerequisites

- **Node.js** ≥ 22.x
- **pnpm** ≥ 10.x
- **MySQL 8** (or compatible: MariaDB 10.6+, TiDB)

### Local Development (without Docker)

1. **Clone the repository:**

```bash
git clone https://github.com/YOUR_USERNAME/xiangqi.git
cd xiangqi
```

2. **Install dependencies:**

```bash
pnpm install
```

3. **Configure environment variables:**

Create a `.env` file in the project root:

```env
DATABASE_URL=mysql://root:password@localhost:3306/xiangqi
JWT_SECRET=your-secret-key-here
NODE_ENV=development

# Optional: Manus OAuth (leave empty for local-only mode)
VITE_APP_ID=
OAUTH_SERVER_URL=
VITE_OAUTH_PORTAL_URL=

# Optional: AI explanations (requires LLM API access)
BUILT_IN_FORGE_API_URL=
BUILT_IN_FORGE_API_KEY=
```

4. **Set up the database:**

```bash
# Create the database
mysql -u root -p -e "CREATE DATABASE xiangqi;"

# Run migrations
pnpm db:push
```

5. **Start the development server:**

```bash
pnpm dev
```

The app will be available at `http://localhost:3000`.

### Local Development (with Docker Compose)

Docker Compose provides a one-command setup with MySQL included.

1. **Clone the repository:**

```bash
git clone https://github.com/YOUR_USERNAME/xiangqi.git
cd xiangqi
```

2. **Start all services:**

```bash
docker compose up
```

This will:
- Start a MySQL 8 database on port 3306
- Install dependencies and run migrations automatically
- Start the development server on port 3000

3. **Access the app:**

Open `http://localhost:3000` in your browser.

4. **Stop services:**

```bash
docker compose down
```

To also remove the database volume:

```bash
docker compose down -v
```

### Production Build

```bash
pnpm build
pnpm start
```

## Project Structure

```
xiangqi/
├── client/                  # Frontend (React + Vite)
│   └── src/
│       ├── components/      # UI components (Board, GameInfoPanel, SearchStatsPanel)
│       ├── hooks/           # Custom hooks (useGameState)
│       ├── lib/             # Core logic
│       │   ├── xiangqi.ts   # Game rules, move generation, validation
│       │   ├── ai.ts        # AI engine (search, evaluation, TT)
│       │   ├── ai.worker.ts # Web Worker wrapper
│       │   └── openingBook.ts # Opening book database
│       └── pages/           # Page components
├── server/                  # Backend (Express + tRPC)
│   ├── routers.ts           # API procedures
│   ├── db.ts                # Database queries
│   └── _core/               # Framework internals
├── drizzle/                 # Database schema & migrations
├── docker-compose.yml       # Docker Compose configuration
├── Dockerfile               # Multi-stage Docker build
└── package.json
```

## Running Tests

```bash
# Run all tests
pnpm test

# Run specific test suites
npx vitest run server/ai-comprehensive.test.ts
npx vitest run server/tactical-regression.test.ts
npx vitest run server/repetition-detection.test.ts
```

## License

MIT
