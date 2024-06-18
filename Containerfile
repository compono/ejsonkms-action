FROM node:20

ENV AWS_REGION
ENV AWS_ACCESS_KEY_ID
ENV AWS_SECRET_ACCESS_KEY

LABEL "com.github.actions.icon"="blue"
LABEL "com.github.actions.color"="database"
LABEL "com.github.actions.name"="ejsonkms action"
LABEL "com.github.actions.description"="Execute encryption and decryption of json files using ejson"
LABEL "org.opencontainers.image.source"="https://github.com/compono/ejsonkms-action"

COPY install-deps.sh /tmp
RUN /tmp/install-deps.sh

COPY . /action
WORKDIR /action

RUN npm install --omit=dev

ENTRYPOINT ["node", "/action/index.js"]
