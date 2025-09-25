FROM public.ecr.aws/docker/library/node:20

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
