import { existsSync, readFileSync } from 'fs';

const envLoader = () => {
  const env = process.env.npm_lifecycle_event || 'dev';
  const path = env.includes('test') ? '.env.test' : '.env';
  if (existsSync(path)) {
    const data = readFileSync(path, { encoding: 'utf8' }).trim().split('\n');
    for (const line of data) {
      const envVar = line.indexOf('=');
      process.env[line.substring(0, envVar)] = line.substring(envVar + 1);
    }
  }
};

export default envLoader;
