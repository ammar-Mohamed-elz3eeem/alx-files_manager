import mongoClient from "../utils/db";
import redisClient from "../utils/redis";

export default class AppController {
	static getStatus(request, response) {
		return response.status(200).json({
			redis: redisClient.isAlive(),
			db: mongoClient.isAlive(),
		});
	}

	static getStats(request, response) {
		Promise.all([mongoClient.nbUsers(), mongoClient.nbFiles()]).then(
			([nbUsers, nbFiles]) => {
				return response.status(200).json({ users: nbUsers, files: nbFiles });
			}
		);
	}
}
