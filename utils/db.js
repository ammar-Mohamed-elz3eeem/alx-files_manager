import MongoClient from 'mongodb/lib/mongo_client';
import { promisify } from 'util';
import envLoader from './env_loader';

class DBClient {
  constructor() {
    envLoader();
    this.mongo = new MongoClient(
      `mongodb://${process.env.DB_HOST}:${process.env.DB_PORT}/${
        process.env.DB_DATABASE || 'files_manager'
      }`
    );
    this.isConnected = false;
    this.mongo.connect(() => (this.isConnected = true));
  }

  isAlive() {
    return this.isConnected;
  }

  async nbUsers() {
    return await this.mongo.db().collection('users').countDocuments();
  }

  async nbFiles() {
    return await this.mongo.db().collection('files').countDocuments();
  }
}

const mongoClient = new DBClient();

export default mongoClient;
