import assert from "node:assert/strict";
import { spawn, execFile } from "node:child_process";
import { once } from "node:events";
import {
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  writeFile,
} from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { promisify } from "node:util";

const exec = promisify(execFile);
const fixtureVite = `
const http = require("node:http");
const { spawn } = require("node:child_process");
const port = Number(process.argv[process.argv.indexOf("--port") + 1]);
http.createServer((req, res) => res.end("export function createHotContext() {}"))
  .listen(port, "127.0.0.1");
if (process.env.DEV_TEST_CHILD_PORT) {
  spawn(process.execPath, ["-e", 'require("node:http").createServer((q,s)=>s.end("child")).listen(Number(process.env.DEV_TEST_CHILD_PORT),"127.0.0.1")'], { stdio: "inherit" });
}
`;

async function fixture(t, { vite = fixtureVite } = {}) {
  const root = await mkdtemp(join(tmpdir(), "saemgil-dev-test-"));
  await mkdir(join(root, "scripts"));
  await mkdir(join(root, "FE/node_modules/vite/bin"), { recursive: true });
  await copyFile(
    new URL("./dev.mjs", import.meta.url),
    join(root, "scripts/dev.mjs"),
  );
  await writeFile(
    join(root, "FE/package.json"),
    JSON.stringify({ devDependencies: { vite: "1.0.0" } }),
  );
  await writeFile(
    join(root, "FE/package-lock.json"),
    JSON.stringify({
      packages: {
        "": { devDependencies: { vite: "1.0.0" } },
        "node_modules/vite": { version: "1.0.0" },
      },
    }),
  );
  await writeFile(
    join(root, "FE/node_modules/vite/package.json"),
    JSON.stringify({ version: "1.0.0" }),
  );
  if (vite !== null)
    await writeFile(join(root, "FE/node_modules/vite/bin/vite.js"), vite);
  const children = [];
  const run = async (...args) => {
    try {
      const result = await exec(
        process.execPath,
        [join(root, "scripts/dev.mjs"), ...args],
        { timeout: 20000, windowsHide: true },
      );
      return { code: 0, output: result.stdout + result.stderr };
    } catch (error) {
      return {
        code: error.code,
        output: (error.stdout || "") + (error.stderr || ""),
      };
    }
  };
  const start = (args, env = {}) => {
    const child = spawn(
      process.execPath,
      [join(root, "scripts/dev.mjs"), ...args],
      {
        env: { ...process.env, ...env },
        windowsHide: true,
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    child.output = "";
    child.stdout.on("data", (data) => {
      child.output += data;
    });
    child.stderr.on("data", (data) => {
      child.output += data;
    });
    children.push(child);
    return child;
  };
  t.after(async () => {
    await run("stop");
    for (const child of children) {
      if (child.exitCode !== null || child.signalCode !== null) continue;
      if (process.platform === "win32")
        await exec("taskkill", ["/PID", String(child.pid), "/T", "/F"]).catch(
          () => {},
        );
      else child.kill("SIGTERM");
    }
  });
  return { root, run, start };
}

async function server(t, handler = (req, res) => res.end("external")) {
  const instance = createServer(handler);
  await new Promise((resolve) => instance.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise((resolve) => instance.close(resolve)));
  return instance.address().port;
}

async function freePort() {
  const instance = createServer();
  await new Promise((resolve) => instance.listen(0, "127.0.0.1", resolve));
  const port = instance.address().port;
  await new Promise((resolve) => instance.close(resolve));
  return port;
}

async function until(check, message, timeout = 15000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (await check()) return;
    await delay(75);
  }
  assert.fail(message());
}

async function responding(port) {
  try {
    return (
      await fetch(`http://127.0.0.1:${port}/`, {
        signal: AbortSignal.timeout(500),
      })
    ).ok;
  } catch {
    return false;
  }
}

test(
  "help and invalid ports do not launch services",
  { timeout: 30000 },
  async (t) => {
    const { run } = await fixture(t);
    assert.match((await run("--help")).output, /start\|stop\|status\|doctor/);
    for (const port of ["0", "65536", "bad", "1.5"]) {
      const result = await run("start", "--fe-port", port);
      assert.equal(result.code, 1);
      assert.match(result.output, /포트/);
    }
    assert.equal((await run("unknown")).code, 1);
  },
);

test(
  "doctor explains missing dependencies without exposing .env values",
  { timeout: 30000 },
  async (t) => {
    const { root, run } = await fixture(t, { vite: null });
    await writeFile(
      join(root, "FE/.env.local"),
      "VITE_VWORLD_API_KEY=do-not-print-this-test-secret\n",
    );
    const result = await run(
      "doctor",
      "--fe-only",
      "--fe-port",
      String(await freePort()),
    );
    assert.equal(result.code, 1);
    assert.match(result.output, /npm ci/);
    assert.doesNotMatch(result.output, /do-not-print-this-test-secret/);
  },
);

test(
  "stale installed dependencies block startup before launching a service",
  { timeout: 30000 },
  async (t) => {
    const { root, run } = await fixture(t);
    await writeFile(
      join(root, "FE/node_modules/vite/package.json"),
      JSON.stringify({ version: "0.9.0" }),
    );
    const port = String(await freePort());
    const checked = await run("doctor", "--fe-only", "--fe-port", port);
    assert.equal(checked.code, 1);
    assert.match(checked.output, /lock 불일치/);
    const started = await run("start", "--fe-only", "--fe-port", port);
    assert.equal(started.code, 1);
    assert.match(started.output, /npm ci/);
    assert.equal(await responding(Number(port)), false);
  },
);

test(
  "occupied ports fail safely and stop leaves unmanaged services alive",
  { timeout: 30000 },
  async (t) => {
    const { run } = await fixture(t);
    const port = await server(t);
    const result = await run("start", "--fe-only", "--fe-port", String(port));
    assert.equal(result.code, 1);
    assert.match(result.output, /사용 중/);
    assert.equal((await run("stop")).code, 0);
    assert.equal(await responding(port), true);
  },
);

test(
  "start, duplicate protection, status, doctor and stop manage only their own process tree",
  { timeout: 45000 },
  async (t) => {
    const { run, start } = await fixture(t);
    const port = await freePort();
    const descendantPort = await freePort();
    const externalPort = await server(t);
    const child = start(["start", "--fe-only", "--fe-port", String(port)], {
      DEV_TEST_CHILD_PORT: String(descendantPort),
    });
    await until(
      () => child.output.includes("[READY]"),
      () => child.output,
    );
    await until(
      () => responding(descendantPort),
      () => "fixture descendant did not start",
    );
    const duplicate = await run(
      "start",
      "--fe-only",
      "--fe-port",
      String(port),
    );
    assert.equal(duplicate.code, 1);
    assert.match(duplicate.output, /이미 실행 중/);
    assert.equal(await responding(port), true);
    const status = await run("status");
    assert.equal(status.code, 0, status.output);
    assert.match(status.output, /ready/);
    assert.match(status.output, new RegExp(`:${port}/`));
    assert.equal((await run("doctor")).code, 0);
    const exited = once(child, "exit");
    const stopped = await run("stop");
    assert.equal(stopped.code, 0, stopped.output);
    assert.deepEqual(await exited, [0, null]);
    await until(
      async () =>
        !(await responding(port)) && !(await responding(descendantPort)),
      () => "managed descendants remained alive after stop",
    );
    assert.equal(await responding(externalPort), true);
    assert.equal((await run("stop")).code, 0, "stop is idempotent");
  },
);

test(
  "a failed child shuts down the session and returns failure",
  { timeout: 30000 },
  async (t) => {
    const { run } = await fixture(t, { vite: "process.exit(7);\n" });
    const result = await run(
      "start",
      "--fe-only",
      "--fe-port",
      String(await freePort()),
    );
    assert.equal(result.code, 1, result.output);
    assert.match(result.output, /FE 종료 \(7\)/);
    assert.match((await run("stop")).output, /세션이 없습니다/);
  },
);

for (const ignoreTerm of [false, true]) {
  test(
    `orphaned descendants are stopped after parent exits (${ignoreTerm ? "force" : "graceful"})`,
    { skip: process.platform === "win32", timeout: 30000 },
    async (t) => {
      const { root, run, start } = await fixture(t, {
        vite: `
const {spawn}=require("node:child_process");
const fs=require("node:fs");
const code='const http=require("node:http"); if(process.env.DEV_TEST_IGNORE_TERM==="1") process.on("SIGTERM",()=>{}); http.createServer((q,s)=>s.end("createHotContext")).listen(Number(process.env.DEV_TEST_CHILD_PORT),"127.0.0.1");';
const child=spawn(process.execPath,["-e",code],{stdio:"inherit"});
fs.writeFileSync("orphan.pid",String(child.pid));
setTimeout(()=>process.exit(7),1500);
`,
      });
      t.after(async () => {
        try {
          const pid = Number(
            await readFile(join(root, "FE/orphan.pid"), "utf8"),
          );
          process.kill(pid, "SIGKILL");
        } catch (error) {
          if (!["ENOENT", "ESRCH"].includes(error.code)) throw error;
        }
      });
      const port = await freePort();
      const externalPort = await server(t);
      const child = start(["start", "--fe-only", "--fe-port", String(port)], {
        DEV_TEST_CHILD_PORT: String(port),
        DEV_TEST_IGNORE_TERM: ignoreTerm ? "1" : "0",
      });
      const exited = once(child, "exit");
      await until(
        () => child.output.includes("[READY]"),
        () => child.output,
      );
      await until(
        () => child.output.includes("FE 종료 (7)"),
        () => child.output,
      );
      await until(
        async () => !(await responding(port)),
        () => "orphaned server remained alive after parent exited",
        8000,
      );
      assert.deepEqual(await exited, [1, null]);
      assert.match(child.output, /\[STOPPED\]/);
      assert.equal(await responding(externalPort), true);
      assert.match((await run("stop")).output, /세션이 없습니다/);
    },
  );
}

test(
  "status separates API response from DB readiness",
  { timeout: 30000 },
  async (t) => {
    const { run } = await fixture(t);
    const fePort = await server(t, (req, res) => res.end("createHotContext"));
    const bePort = await server(t, (req, res) => {
      res.setHeader("content-type", "application/json");
      if (req.url === "/health") res.end('{"status":"ok"}');
      else {
        res.statusCode = 503;
        res.end('{"db":"down"}');
      }
    });
    const result = await run(
      "status",
      "--fe-port",
      String(fePort),
      "--be-port",
      String(bePort),
    );
    assert.equal(result.code, 1);
    assert.match(result.output, /\[OK\] FE/);
    assert.match(result.output, /\[OK\] BE/);
    assert.match(result.output, /\[FAIL\] DB/);
  },
);

test(
  "SIGINT cleans up managed services",
  { skip: process.platform === "win32", timeout: 30000 },
  async (t) => {
    const { start } = await fixture(t);
    const port = await freePort();
    const child = start(["start", "--fe-only", "--fe-port", String(port)]);
    await until(
      () => child.output.includes("[READY]"),
      () => child.output,
    );
    const exited = once(child, "exit");
    child.kill("SIGINT");
    assert.deepEqual(await exited, [0, null]);
    assert.equal(await responding(port), false);
  },
);
