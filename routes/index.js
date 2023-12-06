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

export default routes;
// bob45@dylan.com
