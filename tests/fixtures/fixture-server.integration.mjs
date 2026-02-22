import { spawn } from 'node:child_process';
import { once } from 'node:events';
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';

const HOST = '127.0.0.1';
const PORT = String(4500 + Math.floor(Math.random() * 1000));
const BASE_URL = `http://${HOST}:${PORT}`;

let child;

function startFixtureServer() {
  return spawn('node', ['scripts/serve-fixtures.mjs'], {
    env: { ...process.env, FIXTURE_HOST: HOST, FIXTURE_PORT: PORT },
    stdio: ['ignore', 'pipe', 'pipe']
  });
}

async function waitForServerReady(serverChild) {
  let stdout = '';
  let stderr = '';
  const timeout = setTimeout(() => {
    serverChild.kill('SIGTERM');
  }, 15000);

  serverChild.stdout.on('data', (chunk) => {
    stdout += chunk.toString();
  });
  serverChild.stderr.on('data', (chunk) => {
    stderr += chunk.toString();
  });

  while (true) {
    await new Promise((resolve) => setTimeout(resolve, 100));
    if (stdout.includes(`Fixture server running at ${BASE_URL}`)) {
      clearTimeout(timeout);
      return;
    }

    if (serverChild.exitCode !== null) {
      clearTimeout(timeout);
      throw new Error(`Fixture server exited before ready.\nSTDOUT:\n${stdout}\nSTDERR:\n${stderr}`);
    }
  }
}

before(async () => {
  child = startFixtureServer();
  await waitForServerReady(child);
});

after(async () => {
  if (child && child.exitCode === null) {
    child.kill('SIGTERM');
    await once(child, 'exit');
  }
});

test('fixture server serves alpha no-next flow with css/js assets', async () => {
  const chapter1 = await fetch(`${BASE_URL}/site-alpha/chapter-1.html`);
  assert.equal(chapter1.status, 200);
  const html1 = await chapter1.text();
  assert.match(html1, /Alpha Chapter 1/);
  assert.match(html1, /href="\/shared\/assets\/base.css"/);
  assert.match(html1, /src="\/shared\/assets\/app.js"/);
  assert.match(html1, /href="\/site-alpha\/chapter-2.html"/);

  const chapter2 = await fetch(`${BASE_URL}/site-alpha/chapter-2.html`);
  assert.equal(chapter2.status, 200);
  const html2 = await chapter2.text();
  assert.match(html2, /Alpha Chapter 2/);
  assert.doesNotMatch(html2, /class="next"/);
});

test('fixture server serves beta loop flow', async () => {
  const loopA = await fetch(`${BASE_URL}/site-beta/loop-a.html`);
  assert.equal(loopA.status, 200);
  const htmlA = await loopA.text();
  assert.match(htmlA, /href="\/site-beta\/loop-b.html"/);

  const loopB = await fetch(`${BASE_URL}/site-beta/loop-b.html`);
  assert.equal(loopB.status, 200);
  const htmlB = await loopB.text();
  assert.match(htmlB, /href="\/site-beta\/loop-a.html"/);
});

test('fixture server serves shared assets and default route', async () => {
  const css = await fetch(`${BASE_URL}/shared/assets/base.css`);
  assert.equal(css.status, 200);
  const cssText = await css.text();
  assert.match(cssText, /font-family: Arial, sans-serif/);

  const js = await fetch(`${BASE_URL}/shared/assets/app.js`);
  assert.equal(js.status, 200);
  const jsText = await js.text();
  assert.match(jsText, /window.__fixtureLoaded = true/);

  const root = await fetch(`${BASE_URL}/`);
  assert.equal(root.status, 200);
  const rootHtml = await root.text();
  assert.match(rootHtml, /Alpha Chapter 1/);
});

test('fixture server rejects invalid traversal and missing file', async () => {
  const traversal = await fetch(`${BASE_URL}/../../etc/passwd`);
  assert.ok([400, 404].includes(traversal.status));

  const missing = await fetch(`${BASE_URL}/site-alpha/does-not-exist.html`);
  assert.equal(missing.status, 404);
});
