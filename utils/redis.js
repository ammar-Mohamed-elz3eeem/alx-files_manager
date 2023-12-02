import { createClient } from "redis";
import { promisify } from "util";

class RedisClient {
	constructor() {
		this._redis = createClient();
		this.isConnected = true;
		this._redis.on("error", (err) => console.log(err));
		this._redis.on("connect", (err) => {
			this.isConnected = true;
		});
	}

	isAlive() {
		return this.isConnected;
	}

	async get(key) {
		return await promisify(this._redis.get).bind(this._redis)(key);
	}

	async set(key, value, duration) {
		return await promisify(this._redis.setex).bind(this._redis)(
			key,
			duration,
			value
		);
	}

	async del(key) {
		return await promisify(this._redis.del).bind(this._redis)(key);
	}
}

const redisClient = new RedisClient();

export default redisClient;
