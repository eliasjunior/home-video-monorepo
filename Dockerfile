# Multi-stage Dockerfile for Home Video Monorepo (Merged App)
# Build context: monorepo root
# Usage: docker build -t home-video-app .
# The API serves both REST endpoints and React static files

# Stage 1: Build React web app
FROM node:24-alpine AS build-web

ARG PUBLIC_URL=/home-video
ENV PUBLIC_URL=${PUBLIC_URL}

WORKDIR /build
COPY apps/web/package*.json ./
RUN npm install

COPY apps/web/ ./
RUN PUBLIC_URL=${PUBLIC_URL} npm run build

# Stage 2: Setup API with web build
FROM node:24-alpine

WORKDIR /app

# Install API dependencies
COPY apps/api/package*.json ./
RUN npm install --omit=dev

# Copy API source
COPY apps/api/ ./

# Copy web build from previous stage
COPY --from=build-web /build/build ./web/build

# Expose API port (configurable via SERVER_PORT env var)
EXPOSE 8080

CMD [ "npm", "run", "docker:start"]
