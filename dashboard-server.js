import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { runBenchmark } from "./benchmark-engine.js";

const HOST = "127.0.0.1";
const PORT = Number(process.env.PORT ?? 3000);

const DATASETS = {
  development: "./customer-support-dataset.json",
  heldout: "./customer-support-heldout.json"
};

const STATIC_FILES = {
  "/": {
    file: "./dashboard/index.html",
    contentType: "text/html; charset=utf-8"
  },
  "/styles.css": {
    file: "./dashboard/styles.css",
    contentType: "text/css; charset=utf-8"
  },
  "/app.js": {
    file: "./dashboard/app.js",
    contentType: "text/javascript; charset=utf-8"
  }
};

function sendJson(response, statusCode, data) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff"
  });

  response.end(JSON.stringify(data));
}

function sendText(response, statusCode, message) {
  response.writeHead(statusCode, {
    "Content-Type": "text/plain; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff"
  });

  response.end(message);
}

export function createDashboardServer() {
  return createServer(async (request, response) => {
    let url;

    try {
      url = new URL(request.url, `http://${HOST}:${PORT}`);
    } catch {
      sendJson(response, 400, { error: "Invalid request URL." });
      return;
    }

    if (request.method !== "GET") {
      sendJson(response, 405, {
        error: "Method not allowed."
      });
      return;
    }

    if (url.pathname === "/api/benchmark") {
      const datasetName = url.searchParams.get("dataset") ?? "development";
      const datasetFile = DATASETS[datasetName];

      if (!datasetFile) {
        sendJson(response, 400, {
          error: "Invalid dataset. Use development or heldout."
        });
        return;
      }

      try {
        const dataset = JSON.parse(
          await readFile(new URL(datasetFile, import.meta.url), "utf8")
        );

        const benchmark = runBenchmark(dataset);

        sendJson(response, 200, {
          dataset: datasetName,
          evaluationType: "deterministic",
          llmEvaluation: {
            status: "not_available",
            message: "No live LLM evaluation results are included."
          },
          ...benchmark
        });
      } catch {
        sendJson(response, 500, {
          error: "Unable to load or evaluate the selected dataset."
        });
      }

      return;
    }

    const staticFile = STATIC_FILES[url.pathname];

    if (!staticFile) {
      sendJson(response, 404, {
        error: "Route not found."
      });
      return;
    }

    try {
      const content = await readFile(
        new URL(staticFile.file, import.meta.url)
      );

      response.writeHead(200, {
        "Content-Type": staticFile.contentType,
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff"
      });

      response.end(content);
    } catch {
      sendText(response, 500, "Unable to load dashboard asset.");
    }
  });
}

export function startDashboardServer() {
  const server = createDashboardServer();

  server.listen(PORT, HOST, () => {
    console.log(`Dashboard server listening at http://${HOST}:${PORT}`);
  });

  return server;
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1].replaceAll("\\", "/")}`).href) {
  startDashboardServer();
}
