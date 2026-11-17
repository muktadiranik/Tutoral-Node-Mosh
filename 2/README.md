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
- `npm run seed:customers`: insert 10 sample customers into MongoDB (optional).
- `npm run seed:movies`: insert 10 sample movies using existing genres (optional).
- `npm run seed:rentals`: insert 10 sample rental records without changing stock (optional).
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
Each seed command inserts a new batch every time it runs, so only run it when
you want to add sample data. The customer seed script uses
`vidly/data/customers.js` and the existing `vidly/models/customer.js` model,
including names, gold membership flags, and fictional phone numbers. It uses
the same `MONGODB_URI` setting as the genre seed and disconnects when finished.

The movie seed uses `vidly/data/movies.js` and embeds existing genres' `_id` and
name. Run `npm run seed:vidly` before `npm run seed:movies` in the same database.
If a required genre is missing, no movies are inserted and the script reports
the missing names. It uses the same `MONGODB_URI` setting, disconnects when
finished, and adds another batch of movies on each successful run.

The rental seed uses the model-shaped samples in `vidly/data/rentals.js`.
It finds existing customers by `phone` and movies by `movie.title`, then copies
their current fields and movie IDs into sample rental records. Seed customers
and movies first, using the same `MONGODB_URI`. Missing records stop the script
before insertion. `dateOut` defaults to now, `dateReturned` to null, and
`rentalFee` starts at 0.

This is a seed-only operation: it does not reserve stock, update movies, or
use transactions, so it works with standalone MongoDB like the other seeds.
Each successful run adds another 10 records. It does not clear existing data
and disconnects when finished. This does not change `POST /api/rentals`, which
still updates stock transactionally and requires a replica set or sharded
cluster. Sample rental records are not inventory reservations.

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

### Movie API

- `GET /api/movies`: return movies sorted by title.
- `GET /api/movies/:id`: return one movie.
- `POST /api/movies`: create a movie and return it with status 201.
- `PUT /api/movies/:id`: replace its editable fields and return the updated movie.
- `DELETE /api/movies/:id`: delete and return the movie.

POST and PUT require a body such as:

```json
{
  "title": "The Matrix",
  "genreId": "507f1f77bcf86cd799439011",
  "numberInStock": 10,
  "dailyRentalRate": 2.5
}
```

Use an existing genre's `_id` for `genreId`. The movie embeds that genre's ID
and name. Titles are trimmed and must contain 5–255 characters. Stock must be
an integer from 0–255; the rental rate must be a number from 0–255. Invalid
bodies and invalid or nonexistent genres return 400. Malformed or nonexistent
movie IDs return 404. PUT requires all the same fields as POST.

### Rental API

- `GET /api/rentals`: return rentals sorted by `dateOut`, newest first.
- `GET /api/rentals/:id`: return one rental, or 404 for a malformed or missing ID.
- `POST /api/rentals`: create a rental and reduce the movie's stock by one;
  return the saved rental with status 201 after committing both changes.

POST requires only existing customer and movie IDs:

```json
{
  "customerId": "507f1f77bcf86cd799439011",
  "movieId": "507f1f77bcf86cd799439012"
}
```

Invalid bodies, missing customers/movies, and out-of-stock movies return 400.
The saved rental matches the current model: `customer` is the customer's name,
`isGold` and `phone` are top-level snapshots, and `movie` embeds its ID, title,
and daily rate. `dateOut` defaults to now, `dateReturned` to null, and
`rentalFee` starts at 0. Returns and fee calculation are not implemented.

Creating a rental requires a MongoDB replica set (including a single-node
replica set) or sharded cluster because the stock decrement and rental save
use one transaction. Set `MONGODB_URI` to that deployment; a standalone local
MongoDB server cannot create rentals. A failure aborts both writes rather
than leaving stock and rentals inconsistent. No non-transactional fallback
is used. Read endpoints do not require transactions.

The API tests exercise HTTP routing with mocked model operations and validate
the real Mongoose schema offline; they do not verify live MongoDB persistence.
Rental tests also mock transactions; live commit, rollback, retries, and
concurrent write conflicts still require verification against a replica set.

The `authenticate` middleware is a logging demonstration, not real authentication.
