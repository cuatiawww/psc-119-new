FROM node:lts-alpine

WORKDIR /app

RUN chown -R node:node /app
USER node

COPY --chown=node:node package*.json ./
RUN npm ci

COPY --chown=node:node . .
RUN npm run build

EXPOSE 3000

CMD ["sh", "-c", "HOST=0.0.0.0 PORT=3000 npm start"]
