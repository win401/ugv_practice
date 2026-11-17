import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, writeFile, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import { promisify } from "node:util";
import test from "node:test";

const exec = promisify(execFile);
const root = fileURLToPath(new URL("../", import.meta.url));
const guard = join(root, "scripts/deployment-current.sh");
const linux = { skip: process.platform !== "linux", timeout: 30000 };

async function fixture() {
  const base = await mkdtemp(join(tmpdir(), "saemgil-deploy-test-"));
  const repo = join(base, "repo");
  const remote = join(base, "remote.git");
  await mkdir(repo);
  const git = async (...args) =>
    (await exec("git", args, { cwd: repo })).stdout.trim();
  await git("init", "--bare", "--initial-branch=main", remote);
  await git("init", "--initial-branch=main");
  await git("config", "user.name", "Deployment Regression Test");
  await git("config", "user.email", "deployment-test@example.invalid");
  await git("config", "commit.gpgsign", "false");
  await git("config", "core.autocrlf", "false");
  const hooks = join(base, "empty-hooks");
  await mkdir(hooks);
  await git("config", "core.hooksPath", hooks);
  await git("remote", "add", "origin", pathToFileURL(remote).href);
  const commit = async (files) => {
    for (const [file, data] of Object.entries(files)) {
      const target = join(repo, file);
      if (data === null) await unlink(target);
      else {
        await mkdir(dirname(target), { recursive: true });
        await writeFile(target, data);
      }
    }
    await git("add", "--all");
    await git("commit", "-qm", "test snapshot");
    await git("push", "-q", "origin", "main");
    return git("rev-parse", "HEAD");
  };
  const first = await commit({
    "FE/src/app.ts": "version A\n",
    "FE/package-lock.json": "dependencies A\n",
    "FE/.dockerignore": "dist\n",
    "BE/src/main/java/App.java": "version A\n",
    "BE/build.gradle": "dependencies A\n",
    "BE/.dockerignore": "build\n",
    ".github/workflows/deploy-fe.yml": "workflow A\n",
    ".github/workflows/deploy-be.yml": "workflow A\n",
    "scripts/deployment-current.sh": "guard A\n",
    ".gitattributes": "* text=auto eol=lf\n",
  });
  const check = async (service, sha, cwd = repo) => {
    const output = join(base, `output-${crypto.randomUUID()}`);
    const result = await exec("bash", [guard, service, sha], {
      cwd,
      env: { ...process.env, GITHUB_OUTPUT: output },
      timeout: 20000,
    });
    const values = await readFile(output, "utf8");
    assert.match(values, /^current=(true|false)\n$/);
    return { current: values.trim() === "current=true", stdout: result.stdout };
  };
  return { base, repo, remote, git, commit, first, check };
}

for (const service of ["fe", "be"]) {
  const app = service.toUpperCase();
  const source =
    service === "fe" ? "FE/src/app.ts" : "BE/src/main/java/App.java";
  const tests = service === "fe" ? "FE/tests" : "BE/src/test";

  test(`${service}: workflow serializes jobs without dropping pending runs and gates side effects`, async () => {
    const text = await readFile(
      join(root, `.github/workflows/deploy-${service}.yml`),
      "utf8",
    );
    const concurrency = text.match(
      /^    concurrency:\n((?:      .*\n)+)/m,
    )?.[1];
    assert.ok(concurrency, "deployment job must own the lock");
    assert.match(concurrency, /^      cancel-in-progress: false$/m);
    assert.match(concurrency, /^      queue: max$/m);
    const group = concurrency.match(/^      group: (.+)$/m)?.[1];
    assert.equal(
      group,
      service === "fe" ? "deploy-saemgil-web" : "deploy-saemgil-api",
    );
    const steps = new Map(
      text
        .split("\n      - name: ")
        .slice(1)
        .map((block) => [block.split("\n")[0], block]),
    );
    assert.ok(
      text.indexOf("Check current deployment inputs") <
        text.indexOf("Login to GCP"),
    );
    for (const name of [
      "Login to GCP (WIF)",
      "Setup gcloud",
      "Docker login to Artifact Registry",
      "Setup Docker Buildx",
      "Build and push",
      ...(service === "fe" ? ["Read V-world key"] : []),
    ]) {
      assert.match(
        steps.get(name),
        /if: steps\.build_head\.outputs\.current == 'true'/,
        name,
      );
    }
    assert.match(
      steps.get("Check current deployment inputs"),
      new RegExp(
        `bash scripts/deployment-current.sh ${service} "\\$EXPECTED_SHA"`,
      ),
    );
    assert.match(steps.get("Recheck deployment inputs"), /id: deploy_head/);
    assert.match(
      steps.get("Recheck deployment inputs"),
      /if: steps\.build_head\.outputs\.current == 'true'/,
    );
    assert.ok(
      text.indexOf("Build and push") <
        text.indexOf("Recheck deployment inputs"),
    );
    for (const name of [
      "Deploy",
      service === "fe" ? "Check API proxy" : "Check DB connection",
    ]) {
      assert.match(
        steps.get(name),
        /if: steps\.deploy_head\.outputs\.current == 'true'/,
        name,
      );
    }
    if (service === "fe")
      assert.match(steps.get("Remove temporary V-world key"), /always\(\)/);
  });

  test(
    `${service}: a late older job cannot replace a completed newer deployment`,
    linux,
    async () => {
      const { first, commit, check } = await fixture();
      const latest = await commit({ [source]: "version B\n" });
      const deployed = [];
      for (const sha of [latest, first])
        if ((await check(service, sha)).current) deployed.push(sha);
      assert.deepEqual(deployed, [latest]);
    },
  );

  test(
    `${service}: a main update during build blocks deployment on the second check`,
    linux,
    async () => {
      const { first, commit, check } = await fixture();
      assert.equal((await check(service, first)).current, true);
      await commit({ [source]: "version B\n" });
      assert.equal((await check(service, first)).current, false);
    },
  );

  test(
    `${service}: newer documentation, tests and the other service keep a required deployment eligible`,
    linux,
    async () => {
      const { first, commit, check } = await fixture();
      await commit({
        "README.md": "docs\n",
        [`${app}/README.md`]: "docs\n",
        [`${app}/docs/nested/guide.md`]: "docs\n",
        [`${tests}/fixtures/data.json`]: "test\n",
        [service === "fe" ? "BE/src/main/java/App.java" : "FE/src/app.ts"]:
          "other service B\n",
      });
      assert.equal((await check(service, first)).current, true);
    },
  );

  for (const [name, file] of [
    [
      "dependencies",
      service === "fe" ? "FE/package-lock.json" : "BE/build.gradle",
    ],
    ["hidden build input", `${app}/.dockerignore`],
    ["checkout policy", ".gitattributes"],
    ["deployment workflow", `.github/workflows/deploy-${service}.yml`],
    ["shared deployment guard", "scripts/deployment-current.sh"],
    [
      "runtime markdown",
      service === "fe" ? "FE/public/help.md" : "BE/src/main/resources/help.md",
    ],
  ]) {
    test(`${service}: newer ${name} blocks an older build`, linux, async () => {
      const { first, commit, check } = await fixture();
      await commit({ [file]: "changed input B\n" });
      assert.equal((await check(service, first)).current, false);
    });
  }

  test(
    `${service}: deleting or moving runtime code into docs invalidates an old build`,
    linux,
    async () => {
      const { first, commit, check } = await fixture();
      await commit({
        [source]: null,
        [`${app}/docs/moved-source.txt`]: "version A\n",
      });
      assert.equal((await check(service, first)).current, false);
    },
  );

  test(
    `${service}: shallow checkouts still compare the event tree with newer main`,
    linux,
    async () => {
      const { base, remote, first, commit, check } = await fixture();
      const shallow = join(base, "shallow");
      await exec("git", [
        "clone",
        "--quiet",
        "--depth=1",
        pathToFileURL(remote).href,
        shallow,
      ]);
      await commit({ [source]: "version B\n" });
      assert.equal((await check(service, first, shallow)).current, false);
    },
  );
}

test(
  "missing history or an invalid service fails closed without granting deployment",
  linux,
  async () => {
    const { first, check } = await fixture();
    await assert.rejects(check("fe", "0".repeat(40)));
    await assert.rejects(check("unknown", first));
  },
);
