FROM node:24-alpine AS build

WORKDIR /app
ARG REACT_APP_SERVER_HOST
ARG REACT_APP_SERVER_PROTOCOL
ENV REACT_APP_SERVER_HOST=${REACT_APP_SERVER_HOST}
ENV REACT_APP_SERVER_PROTOCOL=${REACT_APP_SERVER_PROTOCOL}
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM nginx:alpine
COPY nginx/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/build /usr/share/nginx/html
EXPOSE 3000
CMD ["nginx", "-g", "daemon off;"]
