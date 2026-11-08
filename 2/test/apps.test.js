const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const { once } = require("node:events");
const fs = require("node:fs");
const { isBuiltin } = require("node:module");
const path = require("node:path");
const test = require("node:test");

const projectDirectory = path.resolve(__dirname, "..");

async function startApp(t, entry, cwd = projectDirectory) {
  const environment = { ...process.env, NODE_ENV: "development", DEBUG: "" };
  delete environment.NODE_CONFIG_DIR;
  delete environment.NODE_CONFIG;

  const child = spawn(process.execPath, ["-e", `
    const app = require(${JSON.stringify(path.join(projectDirectory, entry))});
    const server = app.listen(0, "127.0.0.1", () => {
      process.send({ port: server.address().port });
    });
  `], {
    cwd,
    env: environment,
    stdio: ["ignore", "ignore", "pipe", "ipc"],
  });

  let diagnostics = "";
  child.stderr.on("data", (chunk) => { diagnostics += chunk; });
  t.after(async () => {
    if (child.pid && child.exitCode === null && child.signalCode === null) {
      const exited = once(child, "exit");
      child.kill();
      await exited;
    }
  });

  let timer;
  const ready = new Promise((resolve, reject) => {
    timer = setTimeout(() => reject(new Error("Application startup timed out")), 10000);
    child.once("message", resolve);
    child.once("error", reject);
    child.once("exit", (code) => reject(new Error(`Application exited ${code}: ${diagnostics}`)));
  });

  let port;
  try {
    ({ port } = await ready);
  } finally {
    clearTimeout(timer);
  }

  return (method, endpoint, body, contentType = "application/json") => fetch(
    `http://127.0.0.1:${port}${endpoint}`,
    {
      method,
      headers: body === undefined ? {} : { "Content-Type": contentType },
      body: body === undefined ? undefined
        : contentType === "application/json" ? JSON.stringify(body) : body,
      signal: AbortSignal.timeout(5000),
    },
  );
}

function sourceFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name === "node_modules" || entry.name === ".git") return [];
    const filename = path.join(directory, entry.name);
    return entry.isDirectory() ? sourceFiles(filename) : [filename];
  });
}

test("all local imports resolve and runtime dependencies are declared", () => {
  const packageJson = JSON.parse(fs.readFileSync(path.join(projectDirectory, "package.json"), "utf8"));

  for (const filename of sourceFiles(projectDirectory)) {
    const source = fs.readFileSync(filename, "utf8");
    if (filename.endsWith(".json")) JSON.parse(source);
    if (!filename.endsWith(".js")) continue;

    for (const [, specifier] of source.matchAll(/require\(["']([^"']+)["']\)/g)) {
      assert.ok(require.resolve(specifier, { paths: [path.dirname(filename)] }));
      if (specifier.startsWith(".") || isBuiltin(specifier)) continue;
      const packageName = specifier.startsWith("@")
        ? specifier.split("/").slice(0, 2).join("/") : specifier.split("/")[0];
      assert.ok(packageJson.dependencies[packageName], `${packageName} must be a runtime dependency`);
    }
  }
});

for (const cwd of [path.dirname(projectDirectory), projectDirectory]) {
  test(`course home page, config, and static files work from ${path.basename(cwd)}`, async (t) => {
    const request = await startApp(t, "index.js", cwd);
    const response = await request("GET", "/");
    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type"), /text\/html/);
    const html = await response.text();
    assert.match(html, /<body>[\s\S]*<table>[\s\S]*<\/table><\/body>/);
    assert.equal((html.match(/<tr>/g) || []).length, 11);
    assert.match(html, /<td>1<\/td><td>C<\/td>/);
    assert.match(html, /<td>10<\/td><td>Express.js<\/td>/);

    const asset = await request("GET", "/text.txt");
    assert.equal(asset.status, 200);
    assert.equal(asset.headers.get("x-content-type-options"), "nosniff");
    assert.equal(await asset.text(), fs.readFileSync(path.join(projectDirectory, "public/text.txt"), "utf8"));
    assert.equal((await request("GET", "/missing-page")).status, 404);
  });
}

for (const resource of [
  { entry: "index.js", endpoint: "/api/courses", count: 10, label: "Course" },
  { entry: "vidly/index.js", endpoint: "/api/genres", count: 16, label: "Genre" },
]) {
  test(`${resource.label} API preserves CRUD and validation`, async (t) => {
    const request = await startApp(t, resource.entry, path.dirname(projectDirectory));
    const list = async () => (await request("GET", resource.endpoint)).json();
    const baseline = await list();

    await t.test("list and individual items use the correct prefix", async () => {
      assert.equal(baseline.length, resource.count);
      assert.deepEqual(await (await request("GET", `${resource.endpoint}/`)).json(), baseline);
      const first = await request("GET", `${resource.endpoint}/${baseline[0].id}`);
      assert.equal(first.status, 200);
      assert.deepEqual(await first.json(), baseline[0]);
      assert.equal((await request("GET", `/${baseline[0].id}`)).status, 404);
    });

    const invalidBodies = [undefined, {}, [], { name: "" }, { name: "ab" },
      { name: 123 }, { name: null }, { name: "Valid", extra: true }];
    for (const method of ["POST", "PUT"]) {
      for (const [index, body] of invalidBodies.entries()) {
        await t.test(`${method} rejects invalid body ${index + 1} without changing data`, async () => {
          const endpoint = method === "POST" ? resource.endpoint : `${resource.endpoint}/${baseline[0].id}`;
          const response = await request(method, endpoint, body);
          assert.equal(response.status, 400);
          assert.ok((await response.text()).length > 0);
          assert.deepEqual(await list(), baseline);
        });
      }
    }

    await t.test("missing and malformed IDs return 404 without crashing", async () => {
      for (const method of ["GET", "PUT", "DELETE"]) {
        for (const id of ["99999", "invalid", "1abc"]) {
          const response = await request(method, `${resource.endpoint}/${id}`,
            method === "PUT" ? { name: "Valid" } : undefined);
          assert.equal(response.status, 404);
          assert.equal(await response.text(), `${resource.label} not found`);
        }
      }
      assert.deepEqual(await list(), baseline);
    });

    await t.test("deleting a middle item removes only that item", async () => {
      const removed = baseline[1];
      const remaining = baseline.filter((item) => item.id !== removed.id);
      const response = await request("DELETE", `${resource.endpoint}/${removed.id}`);
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), resource.label === "Genre" ? remaining : removed);
      assert.deepEqual(await list(), remaining);
      assert.equal((await request("GET", `${resource.endpoint}/${removed.id}`)).status, 404);
    });

    await t.test("create, update, and delete work without reusing IDs", async () => {
      const response = await request("POST", resource.endpoint, { name: "SQL" });
      assert.equal(response.status, 201);
      const created = await response.json();
      assert.equal(created.name, "SQL");
      assert.ok(created.id > Math.max(...baseline.map((item) => item.id)));
      assert.equal(new Set((await list()).map((item) => item.id)).size, resource.count);

      const update = await request("PUT", `${resource.endpoint}/${created.id}`, { name: "Updated" });
      assert.equal(update.status, 200);
      assert.deepEqual(await update.json(), { id: created.id, name: "Updated" });
      assert.deepEqual(await (await request("GET", `${resource.endpoint}/${created.id}`)).json(),
        { id: created.id, name: "Updated" });

      assert.equal((await request("DELETE", `${resource.endpoint}/${created.id}`)).status, 200);
      assert.equal((await request("GET", `${resource.endpoint}/${created.id}`)).status, 404);
      const next = await request("POST", resource.endpoint, { name: "Next" });
      assert.equal(next.status, 201);
      assert.ok((await next.json()).id > created.id);
    });
  });
}

test("the home page shares course changes, escapes HTML, and handles an empty list", async (t) => {
  const request = await startApp(t, "index.js");
  const page = async () => {
    const response = await request("GET", "/");
    assert.equal(response.status, 200);
    return response.text();
  };

  const create = await request("POST", "/api/courses", { name: "<script>alert(1)</script>" });
  assert.equal(create.status, 201);
  const course = await create.json();
  const html = await page();
  assert.ok(html.includes("&lt;script&gt;alert(1)&lt;/script&gt;"));
  assert.ok(!html.includes("<script>alert(1)</script>"));

  const updated = await request("PUT", `/api/courses/${course.id}`, "name=Updated+from+form",
    "application/x-www-form-urlencoded");
  assert.equal(updated.status, 200);
  assert.ok((await page()).includes("Updated from form"));

  const courses = await (await request("GET", "/api/courses")).json();
  for (const item of courses) {
    assert.equal((await request("DELETE", `/api/courses/${item.id}`)).status, 200);
  }
  assert.deepEqual(await (await request("GET", "/api/courses")).json(), []);
  assert.ok((await page()).includes("No courses available."));
});
