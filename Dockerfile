FROM node:20

RUN mkdir -p /opt/ejson/keys

COPY . /action
WORKDIR /action

RUN chmod +x ejson-1.4.1

RUN npm install --production

ENTRYPOINT ["node", "/action/index.js"]