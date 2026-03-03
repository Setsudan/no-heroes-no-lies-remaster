FROM node:20-slim AS build

WORKDIR /app

COPY backend/package*.json ./backend/
WORKDIR /app/backend

RUN npm install

COPY backend/tsconfig.json ./tsconfig.json
COPY backend/src ./src

RUN npm run build

FROM node:20-slim

WORKDIR /app/backend

ENV NODE_ENV=production

COPY backend/package*.json ./
RUN npm install --only=production

COPY --from=build /app/backend/dist ./dist

EXPOSE 4000

CMD ["node", "dist/server.js"]

