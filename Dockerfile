# Multi-stage Dockerfile for Xiangqi (Chinese Chess)
# Stage 1: Install dependencies
FROM node:22-slim AS deps
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.4.1 --activate
COPY package.json pnpm-lock.yaml ./
COPY patches/ ./patches/
RUN pnpm install --frozen-lockfile

# Stage 2: Development (used by docker-compose)
FROM node:22-slim AS dev
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.4.1 --activate
COPY --from=deps /app/node_modules ./node_modules
COPY . .
EXPOSE 3000
CMD ["pnpm", "dev"]

# Stage 3: Build for production
FROM node:22-slim AS builder
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.4.1 --activate
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build

# Stage 4: Production
FROM node:22-slim AS production
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.4.1 --activate
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/client/dist ./client/dist
COPY package.json ./
EXPOSE 3000
ENV NODE_ENV=production
CMD ["node", "dist/index.js"]
