import { Router } from 'express';
import AppController from '../controllers/AppController';
import UserController from '../controllers/UsersController';
import FilesController from '../controllers/FilesController';
import AuthController from '../controllers/AuthController';

const routes = Router();
routes.get('/status', AppController.getStatus);
routes.get('/stats', AppController.getStats);
routes.post('/users', UserController.postNew);

routes.get('/connect', AuthController.getConnect);
routes.get('/disconnect', AuthController.getDisconnect);
routes.get('/users/me', UserController.getMe);

routes.post('/files', FilesController.postUpload);
routes.get('/files/:id', FilesController.getShow);
routes.get('/files', FilesController.getIndex);
routes.put('/files/:id/publish', FilesController.putPublish);
routes.put('/files/:id/unpublish', FilesController.putUnpublish);
routes.get('/files/:id/data', FilesController.getFile);

export default routes;
// bob45@dylan.com
