#!/usr/bin/env node
import { spawn, execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, realpathSync } from "node:fs";
import { chmod, lstat, unlink } from "node:fs/promises";
import { createServer, createConnection } from "node:net";
import { tmpdir, userInfo } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs, promisify } from "node:util";
import { setTimeout as delay } from "node:timers/promises";

const root = realpathSync(join(dirname(fileURLToPath(import.meta.url)), ".."));
const windows = process.platform === "win32";
const checkout = windows ? root.toLowerCase() : root;
const id = createHash("sha256")
  .update(`${userInfo().username}:${checkout}`)
  .digest("hex")
  .slice(0, 20);
const controlPath = windows
  ? `\\\\.\\pipe\\saemgil-dev-${id}`
  : join(tmpdir(), `saemgil-dev-${id}.sock`);
const vite = join(root, "FE/node_modules/vite/bin/vite.js");
const java = process.env.JAVA_HOME
  ? join(
      process.env.JAVA_HOME.replaceAll('"', ""),
      "bin",
      windows ? "java.exe" : "java",
    )
  : "java";
const exec = promisify(execFile);

const help = `Usage: node scripts/dev.mjs <start|stop|status|doctor> [options]
  start     FE + BE 실행. Ctrl+C 또는 다른 터미널의 stop으로 함께 종료
  stop      이 checkout의 도구가 실행한 FE/BE만 종료 (MySQL 유지)
  status    FE, BE, DB 응답과 도구의 실행 상태 확인
  doctor    Node, FE 의존성, Java, Docker, Compose, 포트 확인
  --fe-only       FE만 실행/점검 (Java/Docker 불필요)
  --fe-port PORT  FE 포트 (기본 5174)
  --be-port PORT  BE 포트 (기본 8080)
  --help          사용법 표시`;

function dependenciesReady() {
  try {
    if (!existsSync(vite)) return false;
    const pkg = JSON.parse(readFileSync(join(root, "FE/package.json"), "utf8"));
    const lock = JSON.parse(
      readFileSync(join(root, "FE/package-lock.json"), "utf8"),
    );
    for (const group of ["dependencies", "devDependencies"]) {
      const wanted = pkg[group] || {};
      const locked = lock.packages[""][group] || {};
      for (const name of new Set([
        ...Object.keys(wanted),
        ...Object.keys(locked),
      ])) {
        if (wanted[name] !== locked[name]) return false;
        const installed = JSON.parse(
          readFileSync(
            join(root, "FE/node_modules", name, "package.json"),
            "utf8",
          ),
        );
        if (
          installed.version !== lock.packages[`node_modules/${name}`]?.version
        )
          return false;
      }
    }
    return true;
  } catch {
    return false;
  }
}

async function command(file, args, cwd = root) {
  const { stdout } = await exec(file, args, {
    cwd,
    timeout: 15000,
    maxBuffer: 1024 * 1024,
    windowsHide: true,
  });
  return stdout.trim();
}

async function portFree(port) {
  return new Promise((resolve) => {
    const server = createServer();
    server.once("error", () => resolve(false));
    server.listen({ host: "127.0.0.1", port, exclusive: true }, () =>
      server.close(() => resolve(true)),
    );
  });
}

async function probe(url, expected) {
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(2500),
      redirect: "error",
    });
    return response.ok && expected(await response.text());
  } catch {
    return false;
  }
}

async function health(options) {
  const { fePort, bePort, feOnly } = options;
  const [fe, be, db] = await Promise.all([
    probe(`http://127.0.0.1:${fePort}/@vite/client`, (body) =>
      body.includes("createHotContext"),
    ),
    feOnly
      ? null
      : probe(
          `http://127.0.0.1:${bePort}/health`,
          (body) => JSON.parse(body).status === "ok",
        ),
    feOnly
      ? null
      : probe(
          `http://127.0.0.1:${bePort}/health/db`,
          (body) => JSON.parse(body).db === "up",
        ),
  ]);
  return { fe, be, db };
}

function request(action) {
  return new Promise((resolve, reject) => {
    const socket = createConnection(controlPath);
    let data = "";
    socket.setEncoding("utf8");
    socket.setTimeout(15000, () =>
      socket.destroy(
        new Error("도구 응답 시간 초과. 실행한 터미널의 로그를 확인하세요."),
      ),
    );
    socket.once("connect", () => socket.write(`${action}\n`));
    socket.on("data", (chunk) => {
      data += chunk;
      if (data.length > 8192)
        return socket.destroy(new Error("잘못된 도구 응답"));
      if (data.includes("\n")) {
        try {
          resolve(JSON.parse(data.split("\n")[0]));
        } catch {
          reject(new Error("잘못된 도구 응답"));
        }
        socket.end();
      }
    });
    socket.once("error", (error) => {
      if (["ENOENT", "ECONNREFUSED"].includes(error.code)) resolve(null);
      else reject(error);
    });
    socket.once("end", () => {
      if (!data.includes("\n"))
        reject(new Error("도구 연결이 응답 없이 종료됐습니다."));
    });
  });
}

async function doctor(options, session) {
  const checks = [];
  const check = (name, ok, detail, warning = false) =>
    checks.push({ name, ok, detail, warning });
  check(
    "Node.js",
    Number(process.versions.node.split(".")[0]) === 24,
    `${process.version} (24 필요)`,
  );
  const installed = dependenciesReady();
  check(
    "FE dependencies",
    installed,
    installed
      ? "직접 의존성과 lock 일치"
      : "설치 누락 또는 lock 불일치 — FE 폴더에서 npm ci 실행 필요",
  );
  for (const [name, port] of [
    ["FE", options.fePort],
    ...(options.feOnly ? [] : [["BE", options.bePort]]),
  ]) {
    const free = await portFree(port);
    const owned = session && session[`${name.toLowerCase()}Port`] === port;
    check(
      `${name} port`,
      free || Boolean(owned),
      `${port}: ${free ? "사용 가능" : owned ? "이 도구에서 사용 중" : "사용 중 — 기존 실행을 확인하거나 다른 포트 지정"}`,
      !free && !owned,
    );
  }
  if (!options.feOnly) {
    try {
      const version = await command(java, ["--version"]);
      const major = Number(
        version.match(/^(?:openjdk|java)\s+(?:1\.)?(\d+)/im)?.[1],
      );
      check(
        "Java",
        major >= 17,
        Number.isFinite(major) ? `${major} (17 이상 필요)` : "버전 확인 실패",
      );
    } catch {
      check("Java", false, "JDK 17 이상과 JAVA_HOME/PATH 확인 필요");
    }
    try {
      await command("docker", ["version", "--format", "{{.Server.Version}}"]);
      check("Docker engine", true, "응답함");
    } catch {
      check(
        "Docker engine",
        false,
        "Docker Desktop 설치 및 Engine running 확인 필요",
      );
    }
    try {
      await command("docker", ["compose", "version", "--short"]);
      const config = JSON.parse(
        await command(
          "docker",
          ["compose", "config", "--format", "json"],
          join(root, "BE"),
        ),
      );
      const dbPort = Number(config.services.mysql.ports[0].published);
      const running = await command(
        "docker",
        ["compose", "ps", "--status", "running", "-q", "mysql"],
        join(root, "BE"),
      );
      const free = await portFree(dbPort);
      check(
        "Compose / DB port",
        free || Boolean(running),
        `${dbPort}: ${free ? "사용 가능" : running ? "프로젝트 MySQL 실행 중" : "다른 프로세스가 사용 중 — BE/.env의 SAEMGIL_DB_PORT 확인"}`,
      );
    } catch {
      check(
        "Compose / DB port",
        false,
        "Docker Compose와 BE/compose.yaml 설정 확인 필요",
      );
    }
    check(
      "BE/.env",
      true,
      existsSync(join(root, "BE/.env"))
        ? "파일 있음 (값은 표시하지 않음)"
        : "선택 사항 — 로컬 기본값 사용",
    );
  }
  check(
    "FE/.env.local",
    true,
    existsSync(join(root, "FE/.env.local"))
      ? "파일 있음 (값은 표시하지 않음)"
      : "선택 사항 — 지도 키는 FE/.env.example 참고",
  );
  for (const item of checks)
    console.log(
      `[${item.ok ? "OK" : item.warning ? "WARN" : "FAIL"}] ${item.name}: ${item.detail}`,
    );
  return checks.every((item) => item.ok);
}

async function terminate(child) {
  if (!child.pid) return;
  if (windows && (child.exitCode !== null || child.signalCode !== null)) return;
  // On POSIX the group can outlive its leader. Closed pipes need no further wait.
  const closed =
    child.stdout.destroyed && child.stderr.destroyed
      ? Promise.resolve()
      : new Promise((resolve) => child.once("close", resolve));
  if (windows) {
    // Only a live child created by this supervisor is targeted. No port/PID discovery.
    await command("taskkill", ["/PID", String(child.pid), "/T", "/F"]).catch(
      (error) => {
        if (child.exitCode === null && child.signalCode === null) throw error;
      },
    );
  } else {
    try {
      process.kill(-child.pid, "SIGTERM");
    } catch (error) {
      if (error.code !== "ESRCH") throw error;
    }
    await Promise.race([closed, delay(5000, undefined, { ref: false })]);
    try {
      process.kill(-child.pid, "SIGKILL");
    } catch (error) {
      if (error.code !== "ESRCH") throw error;
    }
  }
  await Promise.race([closed, delay(5000, undefined, { ref: false })]);
}

async function listen(server) {
  if (!windows) {
    // A crashed Unix supervisor can leave a socket. Never replace a live one.
    try {
      const stat = await lstat(controlPath);
      if (
        stat.isSocket() &&
        stat.uid === process.getuid() &&
        !(await request("status"))
      )
        await unlink(controlPath);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }
  await new Promise((resolve, reject) => {
    const onError = (error) =>
      reject(
        error.code === "EADDRINUSE"
          ? new Error("이미 실행 중입니다. status 또는 stop을 사용하세요.")
          : error,
      );
    server.once("error", onError);
    server.listen(controlPath, () => {
      server.off("error", onError);
      resolve();
    });
  });
  if (!windows) await chmod(controlPath, 0o600);
}

async function start(options) {
  const existing = await request("status");
  if (existing)
    throw new Error("이미 실행 중입니다. status 또는 stop을 사용하세요.");
  const children = [];
  let phase = "checking";
  let shutdownPromise;
  let finish;
  const finished = new Promise((resolve) => {
    finish = resolve;
  });
  const server = createServer((socket) => {
    let input = "";
    socket.setEncoding("utf8");
    socket.setTimeout(15000, () => socket.destroy());
    socket.on("error", () => {});
    socket.on("data", async (data) => {
      input += data;
      if (input.length > 128) return socket.destroy();
      if (!input.includes("\n")) return;
      socket.removeAllListeners("data");
      if (input.trim() === "stop") {
        const stopped = await shutdown(0);
        socket.end(`${JSON.stringify({ stopped })}\n`);
      } else socket.end(`${JSON.stringify({ ...options, phase })}\n`);
    });
  });
  function shutdown(code) {
    if (shutdownPromise) return shutdownPromise;
    phase = "stopping";
    shutdownPromise = (async () => {
      const results = await Promise.allSettled(
        children.map(({ child }) => terminate(child)),
      );
      const errors = results.filter((result) => result.status === "rejected");
      if (errors.length)
        console.error(
          "[FAIL] 일부 프로세스 종료 실패. 실행 터미널을 확인하세요.",
        );
      if (server.listening) server.close();
      process.exitCode = errors.length ? 1 : code;
      if (!errors.length)
        console.log(
          "[STOPPED] FE/BE 종료. MySQL 컨테이너와 데이터는 유지합니다.",
        );
      finish();
      return errors.length === 0;
    })();
    return shutdownPromise;
  }
  const interrupt = () => {
    void shutdown(0);
  };
  process.on("SIGINT", interrupt);
  process.on("SIGTERM", interrupt);
  function launch(name, executable, args, cwd, env = process.env) {
    const child = spawn(executable, args, {
      cwd,
      env,
      stdio: ["ignore", "pipe", "pipe"],
      detached: !windows,
      windowsHide: true,
    });
    children.push({ name, child });
    for (const stream of [child.stdout, child.stderr]) {
      stream.on("data", (chunk) => process.stdout.write(`[${name}] ${chunk}`));
    }
    child.once("error", () => {
      console.error(`[FAIL] ${name} 실행 실패`);
      void shutdown(1);
    });
    child.once("exit", (code, signal) => {
      if (phase !== "stopping") {
        console.error(
          `[FAIL] ${name} 종료 (${signal || code}). 함께 실행한 서비스를 정리합니다.`,
        );
        void shutdown(1);
      }
    });
  }
  try {
    await listen(server);
    if (!(await doctor(options)))
      throw new Error("환경 점검 실패. 안내를 확인하고 다시 실행하세요.");
    if (phase === "stopping") return;
    phase = "starting";
    if (!options.feOnly) {
      const appArgs = `--spring.profiles.active=local --server.address=127.0.0.1 --server.port=${options.bePort} --spring.docker.compose.enabled=true --spring.docker.compose.file=compose.yaml --spring.docker.compose.lifecycle-management=start-only`;
      // Call the same Wrapper JAR as gradlew, without a shell or a shared Gradle daemon.
      launch(
        "BE",
        java,
        [
          "-jar",
          "gradle/wrapper/gradle-wrapper.jar",
          "bootRun",
          "--no-daemon",
          "--console=plain",
          `--args=${appArgs}`,
        ],
        join(root, "BE"),
      );
    }
    const env = options.feOnly
      ? process.env
      : {
          ...process.env,
          API_PROXY_TARGET: `http://127.0.0.1:${options.bePort}`,
        };
    launch(
      "FE",
      process.execPath,
      [
        vite,
        "--host",
        "127.0.0.1",
        "--port",
        String(options.fePort),
        "--strictPort",
      ],
      join(root, "FE"),
      env,
    );
    const deadline = Date.now() + 300000;
    while (phase === "starting" && Date.now() < deadline) {
      const result = await health(options);
      if (phase === "stopping") break;
      if (result.fe && (options.feOnly || (result.be && result.db))) {
        phase = "ready";
        console.log(`[READY] FE http://127.0.0.1:${options.fePort}/`);
        if (!options.feOnly)
          console.log(
            `[READY] BE http://127.0.0.1:${options.bePort}/swagger-ui.html (DB up)`,
          );
        console.log(
          "종료: Ctrl+C 또는 다른 터미널에서 node scripts/dev.mjs stop",
        );
        break;
      }
      await delay(500);
    }
    if (phase === "starting")
      throw new Error(
        "5분 안에 준비되지 않았습니다. 위 FE/BE 로그를 확인하세요.",
      );
    await finished;
  } catch (error) {
    await shutdown(1);
    throw error;
  } finally {
    process.off("SIGINT", interrupt);
    process.off("SIGTERM", interrupt);
  }
}

async function main() {
  const { values, positionals } = parseArgs({
    options: {
      "fe-only": { type: "boolean", default: false },
      "fe-port": { type: "string", default: "5174" },
      "be-port": { type: "string", default: "8080" },
      help: { type: "boolean", default: false },
    },
    allowPositionals: true,
  });
  if (values.help || positionals.length === 0) return console.log(help);
  if (
    positionals.length !== 1 ||
    !["start", "stop", "status", "doctor"].includes(positionals[0])
  )
    throw new Error(help);
  const options = {
    feOnly: values["fe-only"],
    fePort: Number(values["fe-port"]),
    bePort: Number(values["be-port"]),
  };
  for (const port of [options.fePort, options.bePort]) {
    if (!Number.isInteger(port) || port < 1 || port > 65535)
      throw new Error("포트는 1~65535 정수로 지정하세요.");
  }
  if (!options.feOnly && options.fePort === options.bePort)
    throw new Error("FE/BE 포트는 서로 달라야 합니다.");
  const action = positionals[0];
  if (action === "start") return start(options);
  const session = await request(action === "stop" ? "stop" : "status");
  if (action === "stop") {
    if (session && !session.stopped)
      throw new Error("일부 프로세스 종료 실패. 실행한 터미널을 확인하세요.");
    console.log(
      session
        ? "[STOPPED] 도구가 실행한 FE/BE 종료 완료"
        : "[STOPPED] 이 도구로 실행한 세션이 없습니다. 별도 실행한 프로세스는 유지합니다.",
    );
    return;
  }
  const current = session || options;
  if (action === "doctor") {
    if (!(await doctor(current, session))) process.exitCode = 1;
    return;
  }
  console.log(
    `[SESSION] ${session ? `${session.phase} (이 도구에서 실행)` : "관리 세션 없음 (별도 실행 서비스도 확인)"}`,
  );
  const result = await health(current);
  console.log(
    `[${result.fe ? "OK" : "FAIL"}] FE http://127.0.0.1:${current.fePort}/`,
  );
  if (!current.feOnly) {
    console.log(
      `[${result.be ? "OK" : "FAIL"}] BE http://127.0.0.1:${current.bePort}/health`,
    );
    console.log(
      `[${result.db ? "OK" : "FAIL"}] DB http://127.0.0.1:${current.bePort}/health/db`,
    );
  }
  if (
    !result.fe ||
    (!current.feOnly && (!result.be || !result.db)) ||
    (session && session.phase !== "ready")
  )
    process.exitCode = 1;
}

main().catch((error) => {
  console.error(`[FAIL] ${error.message}`);
  process.exitCode = 1;
});
