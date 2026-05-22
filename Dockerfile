# Dockerfile
FROM node:22.12.0

# create destination directory
RUN mkdir -p /home/node/app
WORKDIR /home/node/app

# update and install dependency
# RUN apk update && apk upgrade
# RUN apk add git

# copy the app, note .dockerignore
COPY . /home/node/app
RUN npm install
RUN npm run build

EXPOSE 3000

ENV NUXT_HOST=0.0.0.0

ENV NUXT_PORT=3000

CMD [ "node", ".output/server/index.mjs" ]
