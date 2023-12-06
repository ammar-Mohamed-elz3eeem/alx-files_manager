import Queue from 'bull/lib/queue';
import mongodb from 'mongodb';
import imageFunction from 'image-thumbnail';
import { writeFileSync } from 'fs';
import { promisify } from 'util';

import dbClient from './utils/db';

const fileQueue = new Queue('Thumbnails generator');

fileQueue.process(async (job, done) => {
  const userId = job.data.userId || null;
  const fileId = job.data.fileId || null;

  if (!userId) {
    throw new Error('Missing userId');
  }
  if (!fileId) {
    throw new Error('Missing fileId');
  }
  const file = await dbClient.mongo
    .db()
    .collection('files')
    .findOne({
      userId: mongodb.ObjectId(userId),
      _id: mongodb.ObjectId(fileId),
    });
  if (!file) {
    throw new Error('File not found');
  }
  await Promise.all(
    [500, 250, 100].map(async (size) => {
      const buffer = await imageFunction(file.localPath, { width: size });
      console.log(`Generating thumbnail: ${file.localPath}, size: ${size}`);
      promisify(writeFileSync)(`${file.localPath}_${size}`, buffer);
    }),
  );
  done();
});
