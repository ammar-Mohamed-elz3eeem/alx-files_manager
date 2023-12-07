/* eslint-disable import/no-named-as-default */
import dbClient from '../utils/db';

describe('+ DBClient utility', () => {
  before(function (done) {
    this.timeout(10000);
    // await dbClient.mongo.connect();
    dbClient.mongo
      .connect()
      .then(() => {
        return Promise.all([
          dbClient.mongo.db().collection('users'),
          dbClient.mongo.db().collection('files'),
        ]);
      })
      .then(([usersCollection, filesCollection]) => {
        Promise.all([
          usersCollection.deleteMany({}),
          filesCollection.deleteMany({}),
        ]).then(() => {
          done();
        });
      });
  });

  it('+ Client is alive', () => {
    expect(dbClient.isAlive()).to.equal(true);
  });

  it('+ nbUsers returns the correct value', async () => {
    expect(await dbClient.nbUsers()).to.equal(0);
  });

  it('+ nbFiles returns the correct value', async () => {
    expect(await dbClient.nbFiles()).to.equal(0);
  });
});
