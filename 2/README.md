# Node.js tutorial apps

Run these commands from this directory:

```sh
npm install
npm start
```

- `npm start`: course API and Pug home page at `http://localhost:3000/`.
- `npm run dev`: restart the course app automatically while editing.
- `npm run start:vidly`: Vidly genre API at `http://localhost:3000/api/genres`.
- `npm run seed:vidly`: insert the 16 sample genres into MongoDB (optional).
- `npm test`: check imports, validation, CRUD, shared data, and page rendering.

Both apps default to port 3000. Run one at a time or set `PORT` to a different
value for the second app.

Configuration, views, and static files use paths relative to the course app,
so `node 2/index.js` also works from the repository root. `NODE_CONFIG_DIR`
can override the default configuration directory.

Course data is stored in memory and resets on restart. Vidly genres are stored
in MongoDB. Start MongoDB before running Vidly; its default connection is
`mongodb://localhost:27017/mongo-exercises`. Set `MONGODB_URI` to use another
database. Vidly waits for the database connection before accepting requests.

The shared `vidly/models/genre.js` exports the Mongoose model. Both the routes
and the seed script import it directly, without importing the application.
Importing `vidly/index.js` does not connect to MongoDB or insert seed data.
The seed command inserts a new batch every time it runs, so only run it when
you want to add sample data.

### Genre API

- `GET /api/genres`: return the stored genres.
- `GET /api/genres/:id`: return one genre, or 404 if it does not exist.
- `POST /api/genres`: accept `{ "name": "Horror" }` and return the created genre
  with status 201.
- `PUT /api/genres/:id`: replace the name and return the updated genre.
- `DELETE /api/genres/:id`: delete the genre and return the remaining genres.

Names are trimmed and must contain 5–255 characters. Invalid request bodies
return 400. IDs are MongoDB `_id` strings (24 hexadecimal characters), not the
old numeric IDs. Malformed and missing IDs return 404. Unexpected database
errors return 500 without exposing their details to callers.

The genre tests exercise HTTP routing with mocked model operations and validate
the real Mongoose schema offline; they do not verify live MongoDB persistence.

The `authenticate` middleware is a logging demonstration, not real authentication.
