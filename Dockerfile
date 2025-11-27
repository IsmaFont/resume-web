FROM node:25-alpine AS builder

WORKDIR /app

COPY src/package*.json ./
RUN npm install --omit=dev

FROM node:25-alpine

WORKDIR /app

# Non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --chown=nodejs:nodejs src/ ./

USER nodejs

ENV PORT=3000
ENV VERSION=0.1.2

EXPOSE 3000

CMD ["node", "server.js"]

ENTRYPOINT [ "node", "server.js" ]