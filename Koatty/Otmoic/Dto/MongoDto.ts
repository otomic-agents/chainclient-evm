import { MongoClient, ServerApiVersion } from "mongodb";
import { Config, Component, Logger } from "koatty";
@Component()
export class MongoDto {
  @Config("MongoStore", "db")
  public conf: {
    host: string,
    user: string,
    password: string,
    port: string,
    db: string
  }
  constructor() {
    this.init()
  }
  private mongoClient: MongoClient;
  private init() {
    const uri = `mongodb://${this.conf.user}:${this.conf.password}@${this.conf.host}:${this.conf.port}/${this.conf.db}?authSource=${this.conf.db}`;
    Logger.info(uri)
    const client = new MongoClient(uri, {
      serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
      }
    }
    );
    this.mongoClient = client;
  }
  public getClient() {
    return this.mongoClient;
  }
}