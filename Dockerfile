FROM node:20

LABEL "com.github.actions.icon"="blue"
LABEL "com.github.actions.color"="database"
LABEL "com.github.actions.name"="ejson action"
LABEL "com.github.actions.description"="Execute encryption and decryption of json files using ejson"
LABEL "org.opencontainers.image.source"="https://github.com/Drafteame/ejson-action"

RUN curl -sLo ejson.tar.gz https://github.com/Shopify/ejson/releases/download/v1.4.1/ejson_1.4.1_linux_amd64.tar.gz && \
  tar xfvz ejson.tar.gz && \
  mv ejson /usr/local/bin/ && \
  chmod +x /usr/local/bin/ejson && \
  rm ejson.tar.gz

RUN mkdir -p /opt/ejson/keys

COPY . /action
WORKDIR /action

RUN npm install --production

ENTRYPOINT ["node", "/action/index.js"]