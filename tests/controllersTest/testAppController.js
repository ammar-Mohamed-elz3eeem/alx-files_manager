import dbClient from '../../utils/db';

describe('AppController', () => {
  before(function (done) {
    this.timeout(10000);
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

  describe('GET: /status', () => {
    it('Services are online', function (done) {
      request
        .get('/status')
        .expect(200)
        .end((err, res) => {
          if (err) {
            return done(err);
          }
          expect(res.body).to.deep.eql({ redis: true, db: true });
          done();
        });
    });
  });

  describe('GET: /stats', () => {
    it('Correct statistics about db collections', function (done) {
      request
        .get('/stats')
        .expect(200)
        .end((err, res) => {
          if (err) {
            return done(err);
          }
          expect(res.body).to.deep.eql({ users: 0, files: 0 });
          done();
        });
    });

    it('Correct statistics about db collections', function (done) {
      this.timeout(10000);
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
  });
});
