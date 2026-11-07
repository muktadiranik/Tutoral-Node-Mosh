const http = require("http");

const server = http.createServer((req, res) => {
  if (req.url === "/") {
    res.write("Hello World");
    res.end();
  }
  if (req.url === "/api/courses/") {
    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify([
        {
          id: 1,
          course: "Python",
        },
        {
          id: 2,
          course: "JavaScript",
        },
      ]),
    );
  }
});

const port = 3000;
server.listen(port);
console.log(`Server is running on port ${port}`);
