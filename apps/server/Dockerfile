FROM node:20-alpine AS builder

WORKDIR /app

COPY apps/server/package*.json ./
RUN npm ci

COPY apps/server/ .

RUN npm run build

FROM node:20-alpine AS production

WORKDIR /app

COPY apps/server/package*.json ./
RUN npm ci --only=production

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma

COPY wait-for-it.sh ./wait-for-it.sh
RUN chmod +x wait-for-it.sh

RUN npx prisma generate

EXPOSE 3000

CMD ["node", "dist/main"]
