FROM node:22-slim AS base

FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci

FROM base AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM base AS runtime
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 admin
COPY --from=build /app/public ./public
COPY --from=build --chown=admin:nodejs /app/.next/standalone ./
COPY --from=build --chown=admin:nodejs /app/.next/static ./.next/static
USER admin
EXPOSE 3001
ENV PORT=3001
CMD ["node", "server.js"]
