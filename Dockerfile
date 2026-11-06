# ===================================================
# AegisVote Multi-Stage Production Container
# ===================================================

FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json ./
COPY contracts/package*.json ./contracts/
COPY frontend/package*.json ./frontend/

RUN npm install

COPY . .

# Compile smart contracts
RUN npm run compile

# Build frontend production bundle
RUN npm run build

# Stage 2: Production Runner
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production \
    PORT=3000 \
    HOST=0.0.0.0

COPY package*.json ./
COPY frontend/package*.json ./frontend/
RUN npm install --omit=dev --workspace=frontend

COPY --from=builder /app/frontend/build ./build
COPY --from=builder /app/frontend/.svelte-kit ./.svelte-kit
COPY --from=builder /app/contracts/artifacts ./contracts/artifacts

EXPOSE 3000

CMD ["node", "build"]
