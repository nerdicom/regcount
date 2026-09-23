FROM node:24-bookworm-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force
COPY database.mjs http.mjs server.mjs ./
USER node
EXPOSE 8787
CMD ["node", "server.mjs"]
