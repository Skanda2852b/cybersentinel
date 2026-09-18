FROM node:20-alpine AS base

WORKDIR /app

FROM base AS development
ENV NODE_ENV=development
COPY frontend/package*.json ./
COPY package-lock.json ./
RUN npm ci
COPY frontend/. .
EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]

FROM base AS builder
ENV NODE_ENV=production
COPY frontend/package*.json ./
COPY package-lock.json ./
RUN npm ci
COPY frontend/. .
RUN npm run build

FROM base AS production
ENV NODE_ENV=production
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./
EXPOSE 5173
CMD ["npx", "serve", "-s", "dist", "-l", "5173"]