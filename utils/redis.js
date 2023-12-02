import { createClient } from 'redis';
import { promisify } from 'util';

class RedisClient {
  /**
   * Create new RedisClient using constructor
   */
  constructor() {
    this._redis = createClient();
    this.isConnected = true;
    this._redis.on('error', (err) => {
      console.log(
        'Redis client failed to connect:',
        err.message || err.toString()
      );
      this.isConnected = false;
    });
    this._redis.on('connect', (err) => {
      this.isConnected = true;
    });
  }

  /**
   * check weather redis client is connected or not
   *
   * @returns boolean: true if redis is connected, otherwise false
   */
  isAlive() {
    return this.isConnected;
  }

  /**
   * get the value of specified key from the redis client
   *
   * @param {str} key: key to get its value from redis
   * @returns {str | undefined}: value of that key in redis server
   */
  async get(key) {
    return await promisify(this._redis.GET).bind(this._redis)(key);
  }

  async set(key, value, duration) {
    return await promisify(this._redis.SETEX).bind(this._redis)(
      key,
      duration,
      value
    );
  }

  async del(key) {
    return await promisify(this._redis.DEL).bind(this._redis)(key);
  }
}

export const redisClient = new RedisClient();

export default redisClient;
