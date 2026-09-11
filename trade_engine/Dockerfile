# Builder Stage
FROM node:20-alpine AS builder

WORKDIR /trade_engine

COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Runner Stage
FROM node:20-alpine AS runner

WORKDIR /trade_engine

COPY --from=builder /trade_engine ./

CMD ["npm", "start"]