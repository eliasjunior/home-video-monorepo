FROM node:24-alpine
WORKDIR /app
COPY package*.json ./

RUN npm install --omit=dev
COPY . . 
EXPOSE 8080
CMD [ "npm", "run", "docker:start"]
