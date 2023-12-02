import MongoClient from 'mongodb/lib/mongo_client';
import envLoader from './env_loader';

class DBClient {
  constructor() {
    envLoader();
    this.mongo = new MongoClient(
      `mongodb://${process.env.DB_HOST}:${process.env.DB_PORT}/${
        process.env.DB_DATABASE || 'files_manager'
      }`,
    );
    this.mongo.connect();
  }

  isAlive() {
    return this.mongo.isConnected();
  }

  async nbUsers() {
    const nbUsers = await this.mongo
      .db()
      .collection('users')
      .countDocuments();
    return nbUsers;
  }

  async nbFiles() {
    const nbFiles = await this.mongo
      .db()
      .collection('files')
      .countDocuments();
    return nbFiles;
  }
}

const dbClient = new DBClient();

export default dbClient;
