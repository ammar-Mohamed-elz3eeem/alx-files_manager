import Express from 'express';
import routes from './routes';

const app = Express();
const PORT = process.env.PORT || 5000;

app.use(Express.json({ limit: '200mb' }));
app.use(routes);

app.listen(PORT);

export default app;
