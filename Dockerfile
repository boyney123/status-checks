FROM node:12.3.1

LABEL maintainer="David Boyne <boyney123@>"

WORKDIR /usr/src/pullreq

COPY src /usr/src/pullreq/src
COPY package.json /usr/src/pullreq
COPY .env /usr/src/pullreq

RUN npm install

# RUN chown -R nobody /usr/src/pullreq
# USER nobody

CMD [ "npm", "start" ]

