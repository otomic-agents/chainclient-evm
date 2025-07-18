FROM agracio/ubuntu-node-netcore
COPY . /src/

WORKDIR src

RUN npm install gulp -g
RUN npm install
# RUN gulp
RUN npm install -D typescript
RUN npm install -D ts-node
# RUN dotnet build dotnet/StartUp/
WORKDIR dist

CMD npm run start