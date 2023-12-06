import mongodb from 'mongodb';
import { tmpdir } from 'os';
import { join as joinFolders } from 'path';
import { promisify } from 'util';
import { mkdir, writeFile } from 'fs';
import { v4 as uuid4 } from 'uuid';

import dbClient from '../utils/db';
import rdClient from '../utils/redis';

const DEFAULT_FOLDER = 'files_manager';
const MAX_PER_PAGE = 20;

export default class FilesController {
  static async postUpload(req, res) {
    const token = await rdClient.get(`auth_${req.headers['x-token']}`);
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
    if (!fileObj.type || !['folder', 'file', 'image'].includes(fileObj.type)) {
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
        return res.status(400).json({ error: 'Parent is not a folder' });
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
      : '0';
    await promisify(mkdir)(baseDir, { recursive: true });
    if (fileObj.type !== 'folder') {
      const filePath = joinFolders(baseDir, uuid4());
      await promisify(writeFile)(
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

  static async getShow(req, res) {
    const token = await rdClient.get(`auth_${req.headers['x-token']}`);
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
    const document = await dbClient.mongo
      .db()
      .collection('files')
      .findOne({
        $and: [
          { userId: mongodb.ObjectId(token) },
          { _id: mongodb.ObjectId(req.params.id) },
        ],
      });
    if (!document) {
      return res.status(404).json({ error: 'Not found' });
    }
    return res.status(200).json({ ...document });
  }

  static async getIndex(req, res) {
    const token = await rdClient.get(`auth_${req.headers['x-token']}`);
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
    const parentId = req.query.parentId || '0';
    const page = /\d+/.test((req.query.page || '').toString())
      ? Number.parseInt(req.query.page, 10)
      : 0;
    const filesFilter = {
      userId: user._id,
    };
    if (parentId !== '0') {
      filesFilter.parentId = mongodb.ObjectId(parentId);
    }
    const files = await dbClient.mongo
      .db()
      .collection('files')
      .aggregate([
        {
          $match: filesFilter,
        },
        { $sort: { _id: 1 } },
        { $skip: page * MAX_PER_PAGE },
        { $limit: MAX_PER_PAGE },
        {
          $project: {
            _id: 0,
            id: '$_id',
            userId: '$userId',
            name: '$name',
            type: '$type',
            isPublic: '$isPublic',
            parentId: {
              $cond: {
                if: { $ne: ['$parentId', '0'] },
                then: '$parentId',
                else: '$parentId',
              },
            },
          },
        },
      ])
      .toArray();
    return res.status(200).json(files);
  }

  static async putPublish(req, res) {
    const token = await rdClient.get(`auth_${req.headers['x-token']}`);
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
    const document = await dbClient.mongo
      .db()
      .collection('files')
      .findOne({
        $and: [
          { userId: mongodb.ObjectId(token) },
          { _id: mongodb.ObjectId(req.params.id) },
        ],
      });
    if (!document) {
      return res.status(404).json({ error: 'Not found' });
    }
    await dbClient.mongo
      .db()
      .collection('files')
      .updateOne(
        {
          userId: mongodb.ObjectId(token),
          _id: mongodb.ObjectId(req.params.id),
        },
        {
          $set: {
            isPublic: true,
          },
        },
      );
    return res.status(200).json({
      id: req.params.id,
      userId: token,
      name: document.name,
      type: document.type,
      isPublic: true,
      parentId: document.parentId === '0' ? 0 : document.parentId.toString(),
    });
  }

  static async putUnpublish(req, res) {
    const token = await rdClient.get(`auth_${req.headers['x-token']}`);
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
    const document = await dbClient.mongo
      .db()
      .collection('files')
      .findOne({
        $and: [
          { userId: mongodb.ObjectId(token) },
          { _id: mongodb.ObjectId(req.params.id) },
        ],
      });
    if (!document) {
      return res.status(404).json({ error: 'Not found' });
    }
    await dbClient.mongo
      .db()
      .collection('files')
      .updateOne(
        {
          userId: mongodb.ObjectId(token),
          _id: mongodb.ObjectId(req.params.id),
        },
        {
          $set: {
            isPublic: false,
          },
        },
      );
    return res.status(200).json({
      id: req.params.id,
      userId: token,
      name: document.name,
      type: document.type,
      isPublic: false,
      parentId: document.parentId === '0' ? 0 : document.parentId.toString(),
    });
  }
}
