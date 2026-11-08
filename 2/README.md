# Node.js tutorial apps

Run these commands from this directory:

```sh
npm install
npm start
```

- `npm start`: course API and Pug home page at `http://localhost:3000/`.
- `npm run dev`: restart the course app automatically while editing.
- `npm run start:vidly`: Vidly genre API at `http://localhost:3000/api/genres`.
- `npm test`: check imports, validation, CRUD, shared data, and page rendering.

Both apps default to port 3000. Run one at a time or set `PORT` to a different
value for the second app.

Configuration, views, and static files use paths relative to the course app,
so `node 2/index.js` also works from the repository root. `NODE_CONFIG_DIR`
can override the default configuration directory.

Course and genre data are shared in memory within each app and reset on restart.
The `authenticate` middleware is a logging demonstration, not real authentication.
