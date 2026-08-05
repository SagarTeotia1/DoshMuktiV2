# Single-container deploy: Backend (Fastify) + Frontend (Next.js) + Admin (Next.js) + nginx,
# reverse-proxied by domain — doshmukti.com / api.doshmukti.com / admin.doshmukti.com.
# Built for a single VM (Compute Engine), not Cloud Run — nginx binds real ports 80/443.

# ── Backend build ────────────────────────────────────────────────────────────
FROM node:20-alpine AS backend-build
RUN apk add --no-cache openssl libc6-compat
WORKDIR /app/backend
COPY Backend/package*.json ./
RUN npm ci
COPY Backend/ ./
RUN npm run build \
 && npm prune --omit=dev

# ── Frontend build ───────────────────────────────────────────────────────────
FROM node:20-alpine AS frontend-build
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
FROM node:20-alpine AS admin-build
WORKDIR /app/admin
ARG NEXT_PUBLIC_BACKEND_URL=https://api.doshmukti.com
ENV NEXT_PUBLIC_BACKEND_URL=$NEXT_PUBLIC_BACKEND_URL
COPY Admin/package*.json ./
RUN npm ci
COPY Admin/ ./
RUN npm run build

# ── Final runtime image ────────────────────────────────────────────────────────
FROM node:20-alpine
RUN apk add --no-cache openssl libc6-compat nginx bash

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
