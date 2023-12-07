import mongodb from 'mongodb/lib/core';
import { tmpdir } from 'os';
import { join as joinFolders } from 'path';
import { promisify } from 'util';
import { mkdir, writeFile, existsSync, stat, realpath } from 'fs';
import { v4 as uuid4 } from 'uuid';
import { contentType } from 'mime-types';
import Queue from 'bull/lib/queue';

import dbClient from '../utils/db';
import rdClient from '../utils/redis';

const DEFAULT_FOLDER = 'files_manager';
const MAX_PER_PAGE = 20;
const fileQueue = new Queue('Thumbnails generator');

export default class FilesController {
  static async postUpload(req, res) {
    const token = await rdClient.get(`auth_${req.headers['x-token']}`);
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const user = await dbClient.mongo
      .db()
      .collection('users')
      .findOne({ _id: new mongodb.BSON.ObjectId(token) });
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
        .findOne({ _id: new mongodb.BSON.ObjectId(fileObj.parentId) });
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

    const baseDir = folderPath
      ? folderPath
      : joinFolders(tmpdir(), DEFAULT_FOLDER);

    fileObj.userId = new mongodb.BSON.ObjectId(user._id.toString());
    fileObj.parentId = fileObj.parentId
      ? new mongodb.BSON.ObjectId(fileObj.parentId)
      : 0;
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
    if (fileObj.type === 'image') {
      fileQueue.add({
        userId: token,
        fileId: insertedFile.insertedId.toString(),
      });
    }
    return res.status(201).json({
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
      .findOne({ _id: new mongodb.BSON.ObjectId(token) });
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const file = await dbClient.mongo
      .db()
      .collection('files')
      .findOne({
        _id: new mongodb.BSON.ObjectId(
          req.params.id && req.params.id.length == 24
            ? req.params.id
            : Buffer.alloc(12, 0),
        ),
        userId: user._id,
      });
    if (!file) {
      return res.status(404).json({ error: 'Not found' });
    }
    return res.status(200).json({
      id: req.params.id,
      name: file.name,
      userId: file.userId.toString(),
      parentId:
        file.parentId === '0' || file.parentId === 0
          ? 0
          : file.parentId.toString(),
      type: file.type,
      isPublic: file.isPublic,
    });
  }

  static async getIndex(req, res) {
    const token = await rdClient.get(`auth_${req.headers['x-token']}`);
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const user = await dbClient.mongo
      .db()
      .collection('users')
      .findOne({ _id: new mongodb.BSON.ObjectId(token) });
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
    if (parentId !== '0' || parentId !== 0) {
      filesFilter.parentId =
        parentId.length === 24 ? new mongodb.BSON.ObjectId(parentId) : 0;
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
      .findOne({ _id: new mongodb.BSON.ObjectId(token) });
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const file = await dbClient.mongo
      .db()
      .collection('files')
      .findOne({
        userId: new mongodb.BSON.ObjectId(token),
        _id:
          req.params.id && req.params.id.length === 24
            ? new mongodb.BSON.ObjectId(req.params.id)
            : 0,
      });
    if (!file) {
      return res.status(404).json({ error: 'Not found' });
    }
    await dbClient.mongo
      .db()
      .collection('files')
      .updateOne(
        {
          userId: new mongodb.BSON.ObjectId(token),
          _id: new mongodb.BSON.ObjectId(req.params.id),
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
      name: file.name,
      type: file.type,
      isPublic: true,
      parentId: file.parentId === 0 ? 0 : file.parentId.toString(),
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
      .findOne({ _id: new mongodb.BSON.ObjectId(token) });
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const file = await dbClient.mongo
      .db()
      .collection('files')
      .findOne({
        $and: [
          { userId: new mongodb.BSON.ObjectId(token) },
          {
            _id:
              req.params.id && req.params.id.length === 24
                ? new mongodb.BSON.ObjectId(req.params.id)
                : 0,
          },
        ],
      });
    if (!file) {
      return res.status(404).json({ error: 'Not found' });
    }
    await dbClient.mongo
      .db()
      .collection('files')
      .updateOne(
        {
          userId: new mongodb.BSON.ObjectId(token),
          _id: new mongodb.BSON.ObjectId(req.params.id),
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
      name: file.name,
      type: file.type,
      isPublic: false,
      parentId: file.parentId === 0 ? 0 : file.parentId.toString(),
    });
  }

  static async getFile(req, res) {
    const file = await dbClient.mongo
      .db()
      .collection('files')
      .findOne({
        _id:
          req.params.id && req.params.id.length === 24
            ? new mongodb.BSON.ObjectId(req.params.id)
            : 0,
      });
    if (!file) {
      return res.status(404).json({ error: 'Not found' });
    }
    if (file.isPublic !== true) {
      const token = await rdClient.get(`auth_${req.headers['x-token']}`);
      if (!token) {
        return res.status(404).json({ error: 'Not found' });
      }
      const user = await dbClient.mongo
        .db()
        .collection('users')
        .findOne({ _id: new mongodb.BSON.ObjectId(token) });
      if (!user || user._id.toString() !== file.userId.toString()) {
        return res.status(404).json({ error: 'Not found' });
      }
    }
    if (file.type === 'folder') {
      return res.status(400).json({ error: "A folder doesn't have content" });
    }

    let filePath = file.localPath;
    if (req.query.size) {
      filePath = `${file.localPath}_${req.query.size}`;
    }

    if (existsSync(filePath)) {
      const fileInfo = await promisify(stat)(filePath);
      if (!fileInfo.isFile()) {
        return res.status(404).json({ error: 'Not found' });
      }
    } else {
      return res.status(404).json({ error: 'Not found' });
    }
    const absFilePath = await promisify(realpath)(filePath);
    console.log(absFilePath);
    res.setHeader(
      'Content-Type',
      contentType(file.name) || 'text/plain; charset=utf-8',
    );
    return res.status(200).sendFile(absFilePath);
  }
}
