# Build stage
FROM node:22-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# Production stage
FROM lipanski/docker-static-website:2.4.0

COPY --from=build /app/dist .

EXPOSE 3000
