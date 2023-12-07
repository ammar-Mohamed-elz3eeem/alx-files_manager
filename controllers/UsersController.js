import sha1 from 'sha1';
import { ObjectId } from 'mongodb';

import dbClient from '../utils/db';
import rdClient from '../utils/redis';
import Queue from 'bull/lib/queue';

const userQueue = new Queue('welcome user');

export default class UserController {
  static async postNew(request, response) {
    const email = request.body ? request.body.email : null;
    const password = request.body ? request.body.password : null;

    if (!email) {
      return response.status(400).json({ error: 'Missing email' });
    }
    if (!password) {
      return response.status(400).json({ error: 'Missing password' });
    }

    const user = await dbClient.mongo
      .db()
      .collection('users')
      .findOne({ email });

    if (user) {
      return response.status(400).json({ error: 'Already exist' });
    }

    const insertedUser = await dbClient.mongo
      .db()
      .collection('users')
      .insertOne({ email, password: sha1(password) });

    const insertedUserId = insertedUser.insertedId.toString();
    userQueue.add({ userId: insertedUserId });

    return response.status(201).json({ email, id: insertedUserId });
  }

  static async getMe(request, response) {
    const userToken = await rdClient.get(`auth_${request.headers['x-token']}`);
    if (userToken) {
      const user = await dbClient.mongo
        .db()
        .collection('users')
        .findOne({ _id: ObjectId(userToken) });
      response.json({ id: user._id, email: user.email });
      return;
    }
    response.status(401).json({ error: 'Unauthorized' });
  }
}
