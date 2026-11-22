# Vidly integration tests

These tests use **Supertest + Jest + real MongoDB**. They exercise Vidly's HTTP
routes, authentication, validation, Mongoose queries, and stored data without
mocking database operations.

## Run

1. Start your local MongoDB server.
2. From the repository root, run:

   ```powershell
   cd 2
   npm run test:integration
   ```

   If your terminal is already in `2/vidly/`, run `cd ..` first.

There is no need to start Vidly with Node or nodemon. Supertest imports the
Express application from `vidly/index.js`, starts HTTP servers on temporary
ports, and closes them after requests finish. The test setup supplies a fixed
non-production JWT key; no manual environment setup is required.

```sh
npm run test:integration:watch
npm run test:integration:coverage
npm run test:integration -- --runTestsByPath vidly/tests/integration/genres.test.js
npm run test:all
```

Coverage is written to `2/coverage/vidly-integration/`.

## MongoDB configuration and safety

By default, the connection URI comes from `database` in `vidly/config/test.json`.
To use another **test MongoDB server**, set this in the same PowerShell terminal:

```powershell
$env:VIDLY_TEST_MONGODB_URI = "mongodb://127.0.0.1:27017"
npm run test:integration
```

Use a local or dedicated test server, never a production server.

- Every test suite creates a database named `vidly_integration_test_<random-id>`.
- Mongoose's `dbName` option overrides the database portion of the URI. Tests do
  not clear `mongo-exercises`, `mongo-exercises-tests`, or other existing databases.
- The setup verifies the exact generated database name before deleting any data.
- Collections are cleared between tests, preserving indexes.
- The suite's generated database is dropped and the connection closed afterward.
  A forcibly terminated process may leave its generated database behind.
- Connection failures fail the suite rather than skipping tests or using mocks.

## What is covered

- Genres: reads, creates, updates, deletes, normalization, missing IDs, invalid
  names, missing/invalid tokens, and admin-only deletion.
- Users/auth: registration, real bcrypt hashes and JWTs, duplicate emails, invalid
  input, failed login, and a complete registration/login/current-user workflow.

Importing Vidly intentionally does not execute its production startup code.
These tests do not verify startup logging, deployment, or all movie/rental
database behaviors. The existing mocked suite retains those separate checks
and documents known application limitations.

`npm test` and `npm run test:watch` still run the mocked suite without MongoDB.
The Node-runner example in `2/test/genres.test.js` also uses real MongoDB:
`beforeEach` starts a server and seeds genres; `afterEach` awaits server closure
and calls `Genre.deleteMany({})`. It uses its own disposable database and drops
it afterward. Run it from `2/` with `node --test test/genres.test.js`.
Consequently, `npm run test:node` now requires MongoDB too.

`npm run test:all` runs the original Node suite, mocked Jest suite, and this
integration suite, so that command now requires MongoDB.
