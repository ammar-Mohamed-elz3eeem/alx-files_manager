import Queue from 'bull/lib/queue';
import mongodb from 'mongodb';
import imageFunction from 'image-thumbnail';
import { writeFileSync } from 'fs';
import { promisify } from 'util';

import dbClient from './utils/db';
import Mail from 'nodemailer/lib/mailer';
import SMTPConnection from 'nodemailer/lib/smtp-connection';
import { createTransport } from 'nodemailer';

const fileQueue = new Queue('Thumbnails generator');
const userQueue = new Queue('welcome user');

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

userQueue.process(async (job, done) => {
  const userId = job.data.userId || null;
  if (!userId) {
    throw new Error('Missing userId');
  }
  const user = await dbClient.mongo
    .db()
    .collection('users')
    .findOne({ _id: mongodb.ObjectId(userId) });

  if (!user) {
    throw new Error('User not found');
  }

  console.log(`Welcome ${user.email}!`);

  const transporter = createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    auth: {
      user: process.env.SMTP_USERNAME,
      pass: process.env.SMTP_PASSWORD,
    },
  });

  const info = await transporter.sendMail({
    from: '"Files Manager 👻" <ammar@filey.com>',
    to: user.email,
    subject: 'Welcome to Files Manager ✔',
    html: [
      '<div>',
      '<h3>Hello ' + user.email + ',</h3>',
      'Welcome to <a href="https://github.com/ammar-Mohamed-elz3eeem/alx-files_manager">',
      'ALX-Files_Manager</a>, ',
      'a simple file management API built with Node.js by ',
      '<a href="https://github.com/ammar-Mohamed-elz3eeem">Ammar Massoud</a>. ',
      'We hope it meets your needs.',
      '</div>',
    ].join(''),
  });

  done();
});
