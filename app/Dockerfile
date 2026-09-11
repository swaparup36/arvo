# Builder Stage
FROM node:20-alpine AS builder

WORKDIR /app

# NEXT_PUBLIC prefixed envs are supposed to go here

COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Runner Stage
FROM node:20-alpine AS runner

WORKDIR /app

COPY --from=builder /app ./

EXPOSE 3000
CMD ["npm", "start"]