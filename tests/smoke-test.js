const { spawn, execSync, exec } = require('child_process');
const http = require('http');
const path = require('path');
const fs = require('fs');

const ROOT = path.resolve(__dirname, '..');
const FIXTURES = path.join(ROOT, 'tests', 'fixtures');
const BASE_PORT = 4500;
let portOffset = 0;
let passCount = 0;
let failCount = 0;

function pass(msg) {
  passCount++;
  console.log(`  PASS: ${msg}`);
}

function fail(msg) {
  failCount++;
  console.error(`  FAIL: ${msg}`);
}

function nextPort() {
  portOffset++;
  return BASE_PORT + portOffset;
}

// Helper to check if a process is running on Windows/Unix
function killProcess(proc) {
  return new Promise((resolve) => {
    if (!proc) return resolve();
    proc.on('close', () => resolve());
    proc.kill();
  });
}

function startServer(projectDir, port) {
  return new Promise((resolve, reject) => {
    const serverProcess = spawn('node', [
      path.join(ROOT, 'server.js'),
      '--project', projectDir,
      '--port', String(port),
      '--no-open'
    ], { stdio: 'pipe' });

    let started = false;
    let pollInterval;
    let pollCount = 0;

    const cleanup = () => {
      clearInterval(pollInterval);
    };

    pollInterval = setInterval(() => {
      pollCount++;
      if (pollCount > 30) {
        cleanup();
        reject(new Error(`Server at ${projectDir} failed to start on port ${port} after polling.`));
        return;
      }

      const req = http.get(`http://localhost:${port}/`, (res) => {
        if (res.statusCode === 200) {
          cleanup();
          started = true;
          resolve(serverProcess);
        }
      });
      req.on('error', () => {
        // Ignored; server is not ready yet
      });
      req.end();
    }, 200);

    serverProcess.on('error', (err) => {
      cleanup();
      reject(err);
    });

    serverProcess.on('exit', (code) => {
      cleanup();
      if (!started) {
        reject(new Error(`Server exited prematurely with code ${code}`));
      }
    });
  });
}

function getRequest(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({
        statusCode: res.statusCode,
        contentType: res.headers['content-type'],
        body: data
      }));
    }).on('error', reject);
  });
}

async function checkPageAndAssets(name, port) {
  const url = `http://localhost:${port}`;

  try {
    const mainPage = await getRequest(`${url}/`);
    if (mainPage.statusCode === 200) {
      pass(`${name}: GET / -> 200`);
    } else {
      fail(`${name}: GET / did not return 200 (got ${mainPage.statusCode})`);
    }

    for (const asset of ['icon', 'ios-icon', 'splash', 'splash-dark']) {
      const assetRes = await getRequest(`${url}/assets/${asset}`);
      if (assetRes.statusCode === 200 && assetRes.contentType === 'image/png') {
        pass(`${name}: GET /assets/${asset} -> 200 image/png`);
      } else {
        fail(`${name}: GET /assets/${asset} -> got ${assetRes.statusCode} ${assetRes.contentType} (expected 200 image/png)`);
      }
    }

    // Check DOM IDs
    try {
      execSync(`node "${path.join(ROOT, 'tests', 'check-dom-ids.js')}" "${url}/"`, { stdio: 'pipe' });
      pass(`${name}: all client-side DOM id references resolve`);
    } catch (err) {
      fail(`${name}: DOM id check failed -- ${err.stderr ? err.stderr.toString() : err.message}`);
    }

    // 404 test
    const missingRes = await getRequest(`${url}/does-not-exist`);
    if (missingRes.statusCode === 404) {
      pass(`${name}: unknown route -> 404`);
    } else {
      fail(`${name}: unknown route did not 404 (got ${missingRes.statusCode})`);
    }

  } catch (err) {
    fail(`${name}: HTTP requests failed with error: ${err.message}`);
  }
}

async function runTests() {
  console.log("== iconpeek smoke tests (cross-platform) ==");
  console.log();

  // 1. Minimal project
  console.log("[1] minimal (no config found)");
  let port = nextPort();
  let proc;
  try {
    proc = await startServer(path.join(FIXTURES, 'minimal'), port);
    await checkPageAndAssets("minimal", port);
    const res = await getRequest(`http://localhost:${port}/`);
    if (res.body.includes("No app.json")) {
      pass("minimal: warns about missing config");
    } else {
      fail("minimal: expected a 'no config found' warning");
    }
  } catch (err) {
    fail(`minimal: test failed -- ${err.message}`);
  } finally {
    await killProcess(proc);
  }
  console.log();

  // 2. Malformed app.json
  console.log("[2] malformed-json (invalid JSON syntax)");
  port = nextPort();
  try {
    proc = await startServer(path.join(FIXTURES, 'malformed-json'), port);
    await checkPageAndAssets("malformed-json", port);
    const res = await getRequest(`http://localhost:${port}/`);
    if (res.body.includes("Failed to parse") || res.body.includes("Failed to load")) {
      pass("malformed-json: surfaces a parse-failure warning");
    } else {
      fail("malformed-json: expected a parse-failure warning");
    }
  } catch (err) {
    fail(`malformed-json: test failed -- ${err.message}`);
  } finally {
    await killProcess(proc);
  }
  console.log();

  // 3. imageWidth config
  console.log("[3] imagewidth (previously crashed client-side render)");
  port = nextPort();
  try {
    proc = await startServer(path.join(FIXTURES, 'imagewidth'), port);
    await checkPageAndAssets("imagewidth", port);
    const res = await getRequest(`http://localhost:${port}/`);
    if (res.body.includes('"splashImageWidth":160')) {
      pass("imagewidth: config value reaches the page");
    } else {
      fail("imagewidth: splashImageWidth missing from payload");
    }
    if (res.body.includes('id="splashFootnote"')) {
      pass("imagewidth: splashFootnote element present");
    } else {
      fail("imagewidth: splashFootnote element missing");
    }
  } catch (err) {
    fail(`imagewidth: test failed -- ${err.message}`);
  } finally {
    await killProcess(proc);
  }
  console.log();

  // 4. 8-digit hex color
  console.log("[4] hex8-color (#RRGGBBAA background)");
  port = nextPort();
  try {
    proc = await startServer(path.join(FIXTURES, 'hex8-color'), port);
    await checkPageAndAssets("hex8-color", port);
    const res = await getRequest(`http://localhost:${port}/`);
    if (res.body.includes('"adaptiveBackgroundColor":"#F5A623"')) {
      pass("hex8-color: alpha stripped, RGB preserved");
    } else {
      fail("hex8-color: expected #F5A623, color was lost to fallback");
    }
  } catch (err) {
    fail(`hex8-color: test failed -- ${err.message}`);
  } finally {
    await killProcess(proc);
  }
  console.log();

  // 5. Path traversal
  console.log("[5] path-traversal (icon path escapes project root)");
  port = nextPort();
  try {
    proc = await startServer(path.join(FIXTURES, 'path-traversal'), port);
    await checkPageAndAssets("path-traversal", port);
    const res = await getRequest(`http://localhost:${port}/assets/icon`);
    if (res.statusCode === 200) {
      pass("path-traversal: falls back to placeholder instead of erroring");
    } else {
      fail(`path-traversal: expected safe fallback (200), got ${res.statusCode}`);
    }
  } catch (err) {
    fail(`path-traversal: test failed -- ${err.message}`);
  } finally {
    await killProcess(proc);
  }
  console.log();

  // 6. app.config.js with ESM syntax
  console.log("[6] esm-config (export default)");
  port = nextPort();
  try {
    proc = await startServer(path.join(FIXTURES, 'esm-config'), port);
    await checkPageAndAssets("esm-config", port);
    const res = await getRequest(`http://localhost:${port}/`);
    const hasRequireEsm = !!process.features.require_module;
    if (hasRequireEsm) {
      if (res.body.includes('"name":"ESM App"')) {
        pass("esm-config: Node supports require(esm); config loaded natively");
      } else {
        fail("esm-config: expected native require(esm) to load config");
      }
    } else {
      if (res.body.includes("ES module syntax")) {
        pass("esm-config: Node lacks require(esm); specific warning shown");
      } else {
        fail("esm-config: expected ESM-specific warning message");
      }
    }
  } catch (err) {
    fail(`esm-config: test failed -- ${err.message}`);
  } finally {
    await killProcess(proc);
  }
  console.log();

  // 7. Full project
  console.log("[7] full-project (all assets present)");
  port = nextPort();
  try {
    proc = await startServer(path.join(FIXTURES, 'full-project'), port);
    await checkPageAndAssets("full-project", port);
    const res = await getRequest(`http://localhost:${port}/`);
    if (res.body.includes('"warnings":[]')) {
      pass("full-project: no spurious warnings when everything is present");
    } else {
      fail("full-project: unexpected warnings on a fully-populated project");
    }
  } catch (err) {
    fail(`full-project: test failed -- ${err.message}`);
  } finally {
    await killProcess(proc);
  }
  console.log();

  // 8. CLI arg validation
  console.log("[8] CLI argument validation");
  try {
    execSync(`node "${path.join(ROOT, 'server.js')}" --port 0 --no-open`, { stdio: 'pipe' });
    fail("did not reject --port 0");
  } catch (err) {
    if (err.stderr.toString().includes("invalid value for --port")) {
      pass("rejects --port 0");
    } else {
      fail(`failed to reject --port 0 with correct error -- got: ${err.stderr.toString()}`);
    }
  }

  try {
    execSync(`node "${path.join(ROOT, 'server.js')}" --port 99999 --no-open`, { stdio: 'pipe' });
    fail("did not reject --port 99999");
  } catch (err) {
    if (err.stderr.toString().includes("invalid value for --port")) {
      pass("rejects --port 99999");
    } else {
      fail(`failed to reject --port 99999 with correct error -- got: ${err.stderr.toString()}`);
    }
  }
  console.log();

  // 9. generate_icons.py verification
  console.log("[9] generate_icons.py output correctness");
  const tmpSrc = path.join(ROOT, 'tests', 'temp-source.png');
  const tmpOut = path.join(ROOT, 'tests', 'temp-output');

  // Find python command
  let pythonCmd = 'python';
  try {
    execSync('python3 --version', { stdio: 'ignore' });
    pythonCmd = 'python3';
  } catch (err) {
    // Keep 'python'
  }

  try {
    // Create source image
    execSync(`${pythonCmd} -c "from PIL import Image; Image.new('RGBA', (1024, 1024), (255, 0, 0, 255)).save(r'${tmpSrc}')"`, { stdio: 'inherit' });

    // Run generate_icons.py
    execSync(`${pythonCmd} "${path.join(ROOT, 'generate_icons.py')}" --source "${tmpSrc}" --out "${tmpOut}" --android-bg "#F5A623"`, { stdio: 'inherit' });
    pass("generate_icons.py exits 0");

    // Verify iOS AppIcon Contents.json
    const contentsJsonPath = path.join(tmpOut, 'ios', 'AppIcon.appiconset', 'Contents.json');
    const contents = JSON.parse(fs.readFileSync(contentsJsonPath, 'utf8'));
    const idioms = {};
    contents.images.forEach(img => {
      idioms[img.idiom] = (idioms[img.idiom] || 0) + 1;
    });
    if (idioms.iphone === 8 && idioms.ipad === 9 && idioms.class === undefined) {
      pass("iOS AppIcon.appiconset has full iphone+ipad idiom coverage");
    } else {
      fail(`iOS idiom coverage regressed (got ${JSON.stringify(idioms)})`);
    }

    // Verify Android foreground content sizing
    execSync(`${pythonCmd} -c "from PIL import Image; import sys; fg = Image.open(r'${path.join(tmpOut, 'android', 'mipmap-xxhdpi', 'ic_launcher_foreground.png')}'); bbox = fg.getbbox(); fraction = (bbox[2] - bbox[0]) / fg.size[0]; sys.exit(0 if abs(fraction - (72/108)) < 0.01 else 1)"`, { stdio: 'inherit' });
    pass("Android foreground content sized to 72/108 canvas (not 66/108 safe zone)");

    // Verify PLACEHOLDER_BASE64 decodes cleanly
    execSync(`${pythonCmd} -c "import re, base64, sys; content = open(r'${path.join(ROOT, 'generate_icons.py')}').read(); m = re.search(r'PLACEHOLDER_BASE64 = \\\"(.*?)\\\"', content); base64.b64decode(m.group(1), validate=True)"`, { stdio: 'inherit' });
    pass("generate_icons.py PLACEHOLDER_BASE64 decodes cleanly");

  } catch (err) {
    fail(`generate_icons.py verification failed: ${err.message}`);
  } finally {
    // Cleanup
    try { fs.unlinkSync(tmpSrc); } catch(e) {}
    try { fs.rmSync(tmpOut, { recursive: true, force: true }); } catch(e) {}
  }
  console.log();

  console.log("== summary ==");
  console.log(`PASS: ${passCount}  FAIL: ${failCount}`);
  if (failCount > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests();
