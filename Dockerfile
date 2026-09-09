# Single-container deploy: Backend (Fastify) + Frontend (Next.js) + Admin (Next.js) + nginx,
# reverse-proxied by domain — doshmukti.com / api.doshmukti.com / admin.doshmukti.com.
# Built for a single VM (Compute Engine), not Cloud Run — nginx binds real ports 80/443.

# ── Backend build ────────────────────────────────────────────────────────────
# glibc base, not alpine: @xenova/transformers' onnxruntime-node native binary is built
# against glibc and segfaults/aborts under musl (Alpine's libc) with an uncatchable
# "Ort::Exception" — a native abort, not a JS error, so it takes the whole Node process
# down (and with it Frontend/Admin, since all three run in one container) the moment a
# chat turn actually reaches the embedding step. The final runtime stage below must match
# this base for the same reason — building against glibc but running under musl fails
# identically.
FROM node:22-bookworm-slim AS backend-build
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app/backend
COPY Backend/package*.json ./
RUN npm ci
COPY Backend/ ./
RUN npm run build \
 && npm prune --omit=dev

# ── Frontend build ───────────────────────────────────────────────────────────
FROM node:22-alpine AS frontend-build
WORKDIR /app/frontend
ARG NEXT_PUBLIC_BACKEND_URL=https://api.doshmukti.com
ARG NEXT_PUBLIC_RAZORPAY_KEY_ID
ARG NEXT_PUBLIC_SITE_URL=https://doshmukti.com
ARG NEXT_PUBLIC_FIREBASE_API_KEY
ARG NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
ARG NEXT_PUBLIC_FIREBASE_PROJECT_ID
ARG NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
ARG NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
ARG NEXT_PUBLIC_FIREBASE_APP_ID
ARG NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
ENV NEXT_PUBLIC_BACKEND_URL=$NEXT_PUBLIC_BACKEND_URL \
    NEXT_PUBLIC_RAZORPAY_KEY_ID=$NEXT_PUBLIC_RAZORPAY_KEY_ID \
    NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL \
    NEXT_PUBLIC_FIREBASE_API_KEY=$NEXT_PUBLIC_FIREBASE_API_KEY \
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=$NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN \
    NEXT_PUBLIC_FIREBASE_PROJECT_ID=$NEXT_PUBLIC_FIREBASE_PROJECT_ID \
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=$NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET \
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=$NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID \
    NEXT_PUBLIC_FIREBASE_APP_ID=$NEXT_PUBLIC_FIREBASE_APP_ID \
    NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=$NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
COPY Frontend/package*.json ./
RUN npm ci
COPY Frontend/ ./
RUN npm run build

# ── Admin build ───────────────────────────────────────────────────────────────
FROM node:22-alpine AS admin-build
WORKDIR /app/admin
ARG NEXT_PUBLIC_BACKEND_URL=https://api.doshmukti.com
ENV NEXT_PUBLIC_BACKEND_URL=$NEXT_PUBLIC_BACKEND_URL
COPY Admin/package*.json ./
RUN npm ci
COPY Admin/ ./
RUN npm run build

# ── Final runtime image ────────────────────────────────────────────────────────
# Must be glibc (matching backend-build above) for onnxruntime-node — see the comment there.
FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends openssl nginx bash ca-certificates && rm -rf /var/lib/apt/lists/*

# Backend — compiled dist + pruned node_modules + prisma schema/migrations for `migrate deploy`
WORKDIR /app/backend
COPY --from=backend-build /app/backend/dist ./dist
COPY --from=backend-build /app/backend/node_modules ./node_modules
COPY --from=backend-build /app/backend/package.json ./package.json
COPY --from=backend-build /app/backend/prisma ./prisma

# Frontend — Next standalone output (self-contained server.js + minimal node_modules)
WORKDIR /app/frontend
COPY --from=frontend-build /app/frontend/.next/standalone ./
COPY --from=frontend-build /app/frontend/.next/static ./.next/static
COPY --from=frontend-build /app/frontend/public ./public

# Admin — same standalone pattern
WORKDIR /app/admin
COPY --from=admin-build /app/admin/.next/standalone ./
COPY --from=admin-build /app/admin/.next/static ./.next/static
COPY --from=admin-build /app/admin/public ./public

# nginx — domain-based reverse proxy
COPY nginx/nginx.conf /etc/nginx/nginx.conf
RUN mkdir -p /run/nginx

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

WORKDIR /app
EXPOSE 80 443
ENTRYPOINT ["/entrypoint.sh"]
