import sha1 from 'sha1';
import dbClient from '../utils/db';

export default class UserController {
  static async postNew(request, response) {
    const email = request.body ? request.body.email : null;
    const password = request.body ? request.body.password : null;

    if (!email) {
      return response.status(400).json({ error: 'Missing email' });
    }
    if (!password) {
      return response.status(400).json({ error: 'Missing email' });
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

    return response.status(201).json({ email, id: insertedUserId });
  }
}
