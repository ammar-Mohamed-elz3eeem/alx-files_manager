import mongodb from 'mongodb';
import { tmpdir } from 'os';
import { join as joinFolders } from 'path';
import { promisify } from 'util';
import { mkdir, writeFile } from 'fs';
import { v4 as uuid4 } from 'uuid';

import dbClient from '../utils/db';
import rdClient from '../utils/redis';

const DEFAULT_FOLDER = 'files_manager';
export default class FilesController {
  static async postUpload(req, res) {
    const token = await rdClient.get(
      `auth_${req.headers['x-token']}`,
    );
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const user = await dbClient.mongo
      .db()
      .collection('users')
      .findOne({ _id: mongodb.ObjectId(token) });
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const fileObj = {
      name: req.body.name,
      type: req.body.type,
      parentId: req.body.parentId,
      isPublic: req.body.isPublic || false,
    };
    if (!fileObj.name) {
      return res.status(400).json({ error: 'Missing name' });
    }
    if (
      !fileObj.type || !['folder', 'file', 'image'].includes(fileObj.type)
    ) {
      return res.status(400).json({ error: 'Missing type' });
    }
    if (fileObj.type !== 'folder' && !req.body.data) {
      return res.status(400).json({ error: 'Missing data' });
    }
    if (fileObj.parentId) {
      const folder = await dbClient.mongo
        .db()
        .collection('files')
        .findOne({ _id: mongodb.ObjectId(fileObj.parentId) });
      if (!folder) {
        return res.status(400).json({ error: 'Parent not found' });
      }
      if (folder.type !== 'folder') {
        return res
          .status(400)
          .json({ error: 'Parent is not a folder' });
      }
    }
    const folderPath = process.env.FOLDER_PATH
      ? process.env.FOLDER_PATH.trim()
      : '';
    const baseDir = folderPath.length > 0
      ? folderPath
      : joinFolders(tmpdir(), DEFAULT_FOLDER);
    fileObj.userId = mongodb.ObjectId(user._id.toString());
    fileObj.parentId = fileObj.parentId
      ? mongodb.ObjectId(fileObj.parentId)
      : 0;
    await promisify(mkdir)(baseDir, { recursive: true });
    if (fileObj.type !== 'folder') {
      const filePath = joinFolders(baseDir, uuid4());
      promisify(writeFile)(
        filePath,
        Buffer.from(req.body.data, 'base64'),
      );
      fileObj.localPath = filePath;
    }
    const insertedFile = await dbClient.mongo
      .db()
      .collection('files')
      .insertOne(fileObj);
    console.log(insertedFile);
    return res.status(200).json({
      id: insertedFile.insertedId.toString(),
      userId: fileObj.userId,
      name: fileObj.name,
      type: fileObj.type,
      isPublic: fileObj.isPublic,
      parentId: fileObj.parentId,
    });
  }
}
