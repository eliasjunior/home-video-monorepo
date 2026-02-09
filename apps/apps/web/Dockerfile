
# Set the base image
FROM node:15 as build

# Pass environment variables
ENV PATH /app/node_modules/.bin:$PATH
# Set the working directory
WORKDIR /app
# Copy the package.json and package-lock.json
COPY ["package.json", "package-lock.json", ".eslintrc.js", "jsconfig.json", "./"]

# Stage 1: Install dependencies
RUN npm install
RUN npm install react-scripts@5.0.1 -g
COPY . . 
RUN npm run build

# Set nginx base image
FROM nginx:stable-alpine as nginx_app
COPY --from=build /app/build /usr/share/nginx/html
COPY nginx/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]

# Stage 2: Install dependencies
RUN npm install --production --silent
RUN npm install react-scripts@5.0.1 -g --silent
COPY . . 

RUN npm run build

# Set nginx base image
FROM nginx:stable-alpine as nginx_app
COPY --from=build /app/build /usr/share/nginx/html
COPY nginx/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]