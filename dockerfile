FROM agracio/ubuntu-node-netcore
COPY . /src/

WORKDIR src

RUN npm install
RUN npm install -D typescript
RUN npm install -D ts-node
RUN dotnet build dotnet/StartUp/

CMD npm run start