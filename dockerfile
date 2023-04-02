FROM node

COPY . /src/

WORKDIR src

RUN npm install

# CMD cd src && npm install && node server.js
CMD node server.js
