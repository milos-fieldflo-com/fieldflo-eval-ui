FROM node:20-slim AS build
WORKDIR /app
COPY evals-ui/package.json evals-ui/package-lock.json* ./
RUN npm install
COPY evals-ui/ .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY evals-ui/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 3100
