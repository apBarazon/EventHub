FROM node:20-alpine AS base
WORKDIR /app
COPY package*.json ./
RUN npm install --no-audit --no-fund
COPY src ./src
COPY tests ./tests

# ---- test stage: Jenkins runs "docker build --target test" ----
FROM base AS test
RUN npm test

# ---- production stage ----
FROM node:20-alpine AS production
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm install --omit=dev --no-audit --no-fund && npm cache clean --force
COPY src ./src
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=3s --start-period=20s CMD wget -qO- http://localhost:3000/health || exit 1
USER node
CMD ["node", "src/server.js"]
