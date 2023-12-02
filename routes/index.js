import { Router } from 'express';
import AppController from '../controllers/AppController';
import UserController from '../controllers/UsersController';

const routes = Router();

routes.get('/status', AppController.getStatus);
routes.get('/stats', AppController.getStats);
routes.post('/users', UserController.postNew);

export default routes;
