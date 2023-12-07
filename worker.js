import Queue from 'bull/lib/queue';
import mongodb from 'mongodb';
import imageFunction from 'image-thumbnail';
import { writeFileSync } from 'fs';
import { promisify } from 'util';

import dbClient from './utils/db';

const fileQueue = new Queue('Thumbnails generator');

const generateThumbnail = async (path, size) => {
  const buffer = await imageFunction(path, { width: size });
  console.log(`Generating thumbnail: ${path}, size: ${size}`);
  await promisify(writeFileSync)(`${path}_${size}`, buffer);
};

fileQueue.process(async (job, done) => {
  const userId = job.data.userId || null;
  const fileId = job.data.fileId || null;
  console.log('Job Data', job.data);
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
  Promise.all(
    [500, 250, 100].map((size) => generateThumbnail(file.localPath, size)),
  ).then(() => {
    done();
  });
});
