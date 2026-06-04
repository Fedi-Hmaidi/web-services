FROM node:22.12.0-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY src ./src
EXPOSE 4005
CMD ["npm", "start"]
