# Vidly Jest tests

Run from `2/` using the project's Node.js 26 runtime:

```sh
npm test
npm run test:watch
npm run test:node
npm run test:all
npm run test:vidly
npm run test:vidly:coverage
npm run test:integration
npm run test:integration:watch
npm run test:vidly -- --watch
npm run test:vidly -- --runTestsByPath vidly/tests/auth.spec.js
```

`npm test` runs the dedicated Vidly Jest suite once. `npm run test:watch`
reruns it when files change. `npm run test:node` runs only the original Node
suite; `npm run test:all` runs the Node suite, mocked Jest suite, and real
MongoDB integration suite.

For real HTTP and MongoDB tests, see [Integration tests](integration/README.md).
They have a separate Jest configuration and create disposable databases.
`test:integration`, `test:node`, and `test:all` require a running MongoDB server.
The Node suite includes `2/test/genres.test.js`, which uses real MongoDB with
`describe`, `beforeEach`, and `afterEach`. Run that file alone from `2/` with
`node --test test/genres.test.js`.

Jest is already a development dependency. The command enables Node's experimental
VM module support because `config` 5 uses ESM internally. The corresponding Node
experimental warning is expected. Jest uses the Node environment, real timers,
and `resetModules: false`, as recommended for Mongoose.

The setup loads the application's configuration plus `tests/config/test.json`.
This empty test-only overlay supplies the `test` deployment file expected by
node-config without changing application settings or suppressing warnings.

Use these npm commands rather than bare `jest --watchAll`. Bare Jest bypasses
the explicit configuration and Node ESM flag, and discovers `test/*.test.js`,
which use `node:test`, not Jest. Mixing the runners causes ESM loading errors,
module-cache errors such as an undefined app or non-callable seed, and
cross-realm strict-equality failures. Those are runner errors, not reasons to
change the application's exports or weaken the assertions.

## What the mocked suite tests

- Real HTTP requests to the imported Express application on ephemeral localhost ports.
- Public reads, CRUD responses, normalized inputs, malformed JSON, missing IDs,
  authentication requirements, and administrator-only genre deletion.
- Registration/login using real bcrypt and JWT operations, and `/api/users/me`.
- Movie schemas, embedded genres, and current movie write validation behavior.
- Rental snapshots, stock guards, save failures, and best-effort compensation.
- Auth/admin/error middleware, including expired and incorrectly signed JWTs.
- Offline validation of real Mongoose documents.
- Startup order, JWT configuration, failed database startup, connection sharing,
  and actual fatal log file writes in isolated child processes.

Model queries and persistence are mocked; tests never connect to MongoDB, seed,
or modify an existing database. Unstubbed model queries fail immediately because
buffering is disabled in the test environment. Each test restores its spies,
HTTP servers are closed, and child-process log files are created in temporary
directories and removed afterward. Only fixed, non-production signing keys are used.

The concurrency test exercises a mocked guarded stock update. It does **not**
prove real MongoDB concurrency, persistence, transaction, or recovery behavior.
Subprocess-executed startup code is not included in Jest's in-process coverage,
although its behavior is asserted by the child-process tests.

## Current behavior and known limitations

All tests use normal passing assertions; none are skipped or marked as expected
failures. They characterize the current implementation, including these defects:

1. **Security:** registration requires `isAdmin` and currently accepts
   `isAdmin: true`, returning a JWT granting administrator privileges.
2. **Movie POST:** Joi rejects `numberInStock`; omitting it passes Joi but fails
   the real Mongoose document validation because stock is required.
3. **Movie PUT:** requests containing `numberInStock` are rejected. Omitting it
   allows the other fields to be updated while preserving existing stock, since
   Mongoose removes undefined fields from updates (covered in the Node suite).

A green suite does **not** mean these defects are fixed or that the API is safe
for public deployment. Update the corresponding assertions when the application
behavior changes.

## Existing Node tests

The original `node:test` suite under `2/test/` is not replaced;
`npm run test:all` runs it before the two Jest suites, and any failure fails
the command.
Use `npm run test:node`, which limits Node to `test/*.test.js`, rather than
bare `node --test` (which can discover the Jest integration files).
`jest.vidly.config.js` selects the mocked `.spec.js` files and excludes the
integration directory; `jest.integration.config.js` selects only the integration
`.test.js` files. Each runner therefore loads only its own tests.

Running `npm test` from the repository root also runs the tutorial Jest tests
under `tests/tests/` before delegating to the mocked suite in `2/`.
No MongoDB server is required for that command.
