FROM node:20-alpine AS base

WORKDIR /app
RUN apk add --no-cache openssl

FROM base AS development
ENV NODE_ENV=development
COPY backend/package*.json ./
COPY package-lock.json ./
RUN npm ci
COPY backend/. .
EXPOSE 3000
CMD ["npm", "run", "dev"]

FROM base AS builder
ENV NODE_ENV=production
COPY backend/package*.json ./
COPY package-lock.json ./
RUN npm ci --only=production
COPY backend/. .
RUN npm run build

FROM base AS production
ENV NODE_ENV=production
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package.json ./
EXPOSE 3000
CMD ["node", "dist/server.js"]