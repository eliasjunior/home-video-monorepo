# Dockerfile for Docker Compose
# Build context: ./apps directory
# Usage: docker-compose up --build

FROM node:24-alpine AS build-web

ARG PUBLIC_URL=/home-video
ENV PUBLIC_URL=${PUBLIC_URL}

WORKDIR /app/web
COPY web/package*.json ./
RUN npm install
COPY web/ .
RUN PUBLIC_URL=${PUBLIC_URL} npm run build

FROM node:24-alpine
WORKDIR /app
COPY api/package*.json ./
RUN npm install --omit=dev
COPY api/ .
COPY --from=build-web /app/web/build ./web/build
EXPOSE 8080
CMD [ "npm", "run", "docker:start"]
