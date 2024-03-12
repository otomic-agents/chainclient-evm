FROM node

COPY . /src/

WORKDIR src

RUN npm install
RUN npm install -D typescript
RUN npm install -D ts-node

# CMD cd src && npm install && node server.js
CMD ts-node src/index.ts
