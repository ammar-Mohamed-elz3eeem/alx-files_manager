import { v4 as uuid4 } from 'uuid';
import redisClient from '../utils/redis';
import dbClient from '../utils/db';
import sha1 from 'sha1';

export default class AuthController {
  static async getConnect(request, response) {
    console.log(request.headers);
    const encodedToken =
      request.headers['authorization'].split(' ')[1];
    const decodedToken = AuthController.decode64(encodedToken);
    const buff = decodedToken.split(':');
    console.log(buff);
    const email = buff[0];
    const password = buff[1];
    const user = await dbClient.mongo
      .db()
      .collection('users')
      .findOne({ email });
    if (user) {
      if (sha1(password) == user.password) {
        const uuid = uuid4();
        await redisClient.set(
          `auth_${uuid}`,
          user._id.toString(),
          24 * 60 * 60,
        );
        return response.status(200).json({ token: uuid });
      }
    }
    return response.status(401).json({ error: 'Unauthorized' });
  }
  static async getDisconnect(request, response) {
    const userToken = await redisClient.get(
      `auth_${request.headers['x-token']}`,
    );
    console.log(userToken);
    if (userToken) {
      await redisClient.del(`auth_${request.headers['x-token']}`);
      return response.status(204).send();
    }
    return response.status(401).json({ error: 'Unauthorized' });
  }
  static decode64(encoded) {
    const buff = Buffer.from(encoded, 'base64');
    return buff.toString('utf-8');
  }
}
