FROM node:24-alpine AS build-web
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
