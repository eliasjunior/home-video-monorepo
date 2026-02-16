# Multi-stage Dockerfile for Home Video Monorepo
# Builds both web and api apps

# Stage 1: Build web app
FROM node:24-alpine AS web-build

WORKDIR /monorepo
COPY package*.json ./
COPY apps/web/package*.json ./apps/web/

# Install all dependencies at monorepo level
RUN npm install

# Copy web app source and build
COPY apps/web ./apps/web
WORKDIR /monorepo/apps/web
RUN npm run build

# Stage 2: Setup API
FROM node:24-alpine AS api-setup

WORKDIR /app
COPY apps/api/package*.json ./
RUN npm install --omit=dev
COPY apps/api .

# Stage 3: Final runtime with both apps
FROM node:24-alpine

# Install nginx for serving web app
RUN apk add --no-cache nginx

# Setup API
WORKDIR /app
COPY --from=api-setup /app ./

# Setup web app with nginx
COPY --from=web-build /monorepo/apps/web/build /usr/share/nginx/html
COPY apps/web/nginx/nginx.conf /etc/nginx/conf.d/default.conf

# Expose ports
EXPOSE 8080 3000

# Create startup script
RUN echo '#!/bin/sh' > /start.sh && \
    echo 'nginx' >> /start.sh && \
    echo 'cd /app && npm run docker:start' >> /start.sh && \
    chmod +x /start.sh

CMD ["/start.sh"]
