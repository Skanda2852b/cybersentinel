FROM node:20-alpine AS base

WORKDIR /app

FROM base AS development
ENV NODE_ENV=development
COPY package.json ./
RUN npm install
COPY . .
EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]

FROM base AS builder
ENV NODE_ENV=production
COPY package.json ./
RUN npm install --include=dev
COPY . .
RUN npm run build

FROM base AS production
ENV NODE_ENV=production
RUN npm install -g serve
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./
EXPOSE 5173
CMD ["serve", "-s", "dist", "-l", "5173"]
