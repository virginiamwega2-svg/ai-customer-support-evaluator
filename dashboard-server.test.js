import test from "node:test";
import assert from "node:assert/strict";

import { createDashboardServer } from "./dashboard-server.js";

async function startTestServer(t) {
  const server = createDashboardServer();

  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });

  t.after(() => new Promise((resolve) => server.close(resolve)));

  return `http://127.0.0.1:${server.address().port}`;
}

test("serves the development benchmark through the API", async (t) => {
  const baseUrl = await startTestServer(t);
  const response = await fetch(`${baseUrl}/api/benchmark`);
  const data = await response.json();

  assert.equal(response.status, 200);
  assert.equal(data.dataset, "development");
  assert.equal(data.evaluationType, "deterministic");
  assert.equal(data.scenarioCount, 6);
  assert.equal(data.responseCount, 20);
  assert.equal(data.llmEvaluation.status, "not_available");
});

test("serves the held-out benchmark independently", async (t) => {
  const baseUrl = await startTestServer(t);
  const response = await fetch(`${baseUrl}/api/benchmark?dataset=heldout`);
  const data = await response.json();

  assert.equal(response.status, 200);
  assert.equal(data.dataset, "heldout");
  assert.equal(data.scenarioCount, 3);
  assert.equal(data.responseCount, 3);
});

test("rejects an invalid dataset", async (t) => {
  const baseUrl = await startTestServer(t);
  const response = await fetch(`${baseUrl}/api/benchmark?dataset=unknown`);
  const data = await response.json();

  assert.equal(response.status, 400);
  assert.match(data.error, /Invalid dataset/);
});

test("serves all dashboard assets with correct content types", async (t) => {
  const baseUrl = await startTestServer(t);

  const assets = [
    {
      path: "/",
      contentType: "text/html; charset=utf-8",
      expectedContent: "Evaluation dashboard"
    },
    {
      path: "/styles.css",
      contentType: "text/css; charset=utf-8",
      expectedContent: ":root"
    },
    {
      path: "/app.js",
      contentType: "text/javascript; charset=utf-8",
      expectedContent: "loadDataset"
    }
  ];

  for (const asset of assets) {
    const response = await fetch(`${baseUrl}${asset.path}`);
    const content = await response.text();

    assert.equal(response.status, 200, asset.path);
    assert.equal(
      response.headers.get("content-type"),
      asset.contentType,
      asset.path
    );
    assert.ok(content.includes(asset.expectedContent), asset.path);
  }
});

test("returns 404 for unknown routes", async (t) => {
  const baseUrl = await startTestServer(t);
  const response = await fetch(`${baseUrl}/unknown`);
  const data = await response.json();

  assert.equal(response.status, 404);
  assert.match(data.error, /Route not found/);
});

test("rejects unsupported HTTP methods", async (t) => {
  const baseUrl = await startTestServer(t);
  const response = await fetch(`${baseUrl}/api/benchmark`, {
    method: "POST"
  });
  const data = await response.json();

  assert.equal(response.status, 405);
  assert.match(data.error, /Method not allowed/);
});
