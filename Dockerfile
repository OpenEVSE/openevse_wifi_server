FROM node:10-jessie

ARG PORT=3000
ENV PORT $PORT
EXPOSE $PORT

ARG NODE_ENV=production
ENV NODE_ENV $NODE_ENV

WORKDIR /app
COPY . /app

RUN npm install

USER node
CMD [ "npm", "start" ]
