# Base Node.js image
FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app

# Install dependencies
COPY package.json package-lock.json* ./
COPY prisma ./prisma/
COPY prisma.config.ts ./
RUN npm ci

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Copy prisma config
COPY prisma.config.ts ./

# Generate Prisma Client
RUN npx prisma generate

# Build Next.js
ENV SKIP_ENV_VALIDATION=1
RUN npm run build

# Production image, copy all the files and run next
# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

# Don't run as root
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY package.json package-lock.json* ./

# Install only production dependencies
COPY prisma ./prisma/
COPY prisma.config.ts ./
RUN npm ci --only=production

# Generate Prisma Client for runtime
RUN npx prisma generate

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next

USER nextjs

EXPOSE 3000

ENV PORT=3000
# set hostname to localhost
ENV HOSTNAME="0.0.0.0"

CMD ["npm", "start"]
