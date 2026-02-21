# Dockerfile for Docker Compose
# Build context: ./apps directory
# Usage: docker-compose up --build

FROM node:24-alpine AS build-web

ARG PUBLIC_URL=/home-video
ARG REACT_APP_LOGIN_SECOND_RETRY=false
ARG REACT_APP_LOGIN_SECOND_RETRY_URL=

ENV PUBLIC_URL=${PUBLIC_URL}
ENV REACT_APP_LOGIN_SECOND_RETRY=${REACT_APP_LOGIN_SECOND_RETRY}
ENV REACT_APP_LOGIN_SECOND_RETRY_URL=${REACT_APP_LOGIN_SECOND_RETRY_URL}

WORKDIR /app/web
COPY web/package*.json ./
RUN npm install
COPY web/ .
RUN npm run build

FROM node:24-alpine
WORKDIR /app
COPY api/package*.json ./
RUN npm install --omit=dev
COPY api/ .
COPY --from=build-web /app/web/build ./web/build
EXPOSE 8080
CMD [ "npm", "run", "docker:start"]
