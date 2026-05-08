FROM node:20-slim AS build

WORKDIR /app/frontend

COPY package*.json ./
RUN npm install

COPY . .
ARG VITE_API_BASE_URL
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
RUN npm run build

FROM nginx:1.27-alpine

WORKDIR /usr/share/nginx/html

COPY --from=build /app/frontend/dist ./

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]

