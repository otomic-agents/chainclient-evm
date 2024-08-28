export default {
  "RedisStore": {
    host: "${REDIS_HOST}",
    password: "${REDIS_PASSWORD}",
    port: "${REDIS_PORT}"
  },
  "MongoStore": {
    host: "${MONGODB_HOST}",
    user: "${MONGODB_ACCOUNT}",
    password: "${MONGODB_PASSWORD}",
    port: "${MONGODB_PORT}",
    db: "${MONGODB_DBNAME_LP_STORE}"
  }
};