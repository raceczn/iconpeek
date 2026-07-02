#!/usr/bin/env node

const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const DEFAULT_PORT = 4200;
const PLACEHOLDER_ICON = path.join(__dirname, 'assets', 'placeholder-icon.png');
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const sseClients = [];
const activeWatchers = new Map();
let notifyDebounceTimeout = null;

function notifyClients() {
  clearTimeout(notifyDebounceTimeout);
  notifyDebounceTimeout = setTimeout(() => {
    for (const client of sseClients) {
      client.write('data: reload\n\n');
    }
  }, 100);
}

function updateWatchers(projectRoot) {
  const state = buildState(projectRoot);
  const filesToWatch = [
    path.join(__dirname, 'style.css'),
    path.join(__dirname, 'index.html')
  ];

  if (state.configPath) filesToWatch.push(state.configPath);
  if (state.assets.icon.path && !state.assets.icon.placeholder) filesToWatch.push(state.assets.icon.path);
  if (state.assets.iosIcon.path && !state.assets.iosIcon.placeholder) filesToWatch.push(state.assets.iosIcon.path);
  if (state.assets.splash.path && !state.assets.splash.placeholder) filesToWatch.push(state.assets.splash.path);
  if (state.assets.splashDark.path && !state.assets.splashDark.placeholder) filesToWatch.push(state.assets.splashDark.path);

  // Clean up old watchers
  for (const [filePath, watcher] of activeWatchers.entries()) {
    if (!filesToWatch.includes(filePath)) {
      watcher.close();
      activeWatchers.delete(filePath);
    }
  }

  // Add new watchers
  for (const filePath of filesToWatch) {
    if (!activeWatchers.has(filePath)) {
      try {
        if (fs.existsSync(filePath)) {
          const watcher = fs.watch(filePath, () => {
            notifyClients();
            // Re-evaluate files in case config path or assets changed
            updateWatchers(projectRoot);
          });
          activeWatchers.set(filePath, watcher);
        }
      } catch (e) {
        // File may be missing or locked
      }
    }
  }
}


function parseArgs(argv) {
  const options = {
    projectRoot: process.cwd(),
    port: DEFAULT_PORT,
    open: true,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--project') {
      const value = argv[index + 1];
      if (!value) {
        throw new Error('Missing value for --project');
      }
      options.projectRoot = path.resolve(value);
      index += 1;
      continue;
    }

    if (arg === '--port') {
      const value = argv[index + 1];
      const parsed = value && /^\d+$/.test(value) ? Number(value) : NaN;
      if (!value || Number.isNaN(parsed) || parsed < 1 || parsed > 65535) {
        throw new Error('Missing or invalid value for --port (expected 1-65535)');
      }
      options.port = parsed;
      index += 1;
      continue;
    }

    if (arg === '--no-open') {
      options.open = false;
      continue;
    }

    if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
}

function printHelp() {
  process.stdout.write(
    [
      'iconpeek',
      '',
      'Usage:',
      '  npx iconpeek',
      '  npx iconpeek --project /path/to/expo/app',
      '  npx iconpeek --port 5000',
      '  npx iconpeek --no-open',
      '',
      'Flags:',
      '  --project <path>   Expo project root (default: current working directory)',
      '  --port <number>    Starting port (default: 4200)',
      '  --no-open          Do not open a browser window',
      '',
    ].join('\n')
  );
}

function ensurePlaceholderAsset() {
  if (fs.existsSync(PLACEHOLDER_ICON)) {
    return;
  }

  fs.mkdirSync(path.dirname(PLACEHOLDER_ICON), { recursive: true });
  const placeholderBase64 =
    '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';
  fs.writeFileSync(PLACEHOLDER_ICON, Buffer.from(placeholderBase64, 'base64'));
}

function parseConfigFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }

  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw);
  } catch (error) {
    return {
      __error: `Failed to parse ${path.basename(filePath)}: ${error.message}`,
    };
  }
}

function parseJsConfigFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }

  try {
    delete require.cache[require.resolve(filePath)];
    const loaded = require(filePath);
    const config = loaded && loaded.default ? loaded.default : loaded;
    if (typeof config === 'function') {
      return config({ config: {} });
    }
    return config;
  } catch (error) {
    // Node 20.19+/22.12+ ship require(esm) unflagged, so "export default" in
    // app.config.js works natively there and this branch won't be hit. On
    // older Node (down to this package's declared >=14 floor), require()
    // still throws ERR_REQUIRE_ESM on ESM syntax, so give a specific,
    // actionable message instead of a generic parse failure.
    const looksLikeEsm =
      error.code === 'ERR_REQUIRE_ESM' ||
      (error instanceof SyntaxError && /export|import/.test(error.message));

    const message = looksLikeEsm
      ? `Failed to load ${path.basename(filePath)}: it uses ES module syntax (import/export). ` +
        `This Node.js version (${process.version}) can't require() that. Either upgrade to ` +
        `Node 20.19+/22.12+ (which support this natively), convert the file to ` +
        `"module.exports = ({ config }) => ({ ...config })", or use app.json / app.config.json instead.`
      : `Failed to load ${path.basename(filePath)}: ${error.message}`;

    return { __error: message };
  }
}
function detectConfig(projectRoot) {
  const jsonCandidates = ['app.json', 'app.config.json'];

  for (const name of jsonCandidates) {
    const filePath = path.join(projectRoot, name);
    const parsed = parseConfigFile(filePath);
    if (parsed) {
      return {
        configPath: filePath,
        configName: name,
        raw: parsed,
      };
    }
  }

  const jsConfigPath = path.join(projectRoot, 'app.config.js');
  const parsedJsConfig = parseJsConfigFile(jsConfigPath);
  if (parsedJsConfig) {
    return {
      configPath: jsConfigPath,
      configName: 'app.config.js',
      raw: parsedJsConfig,
    };
  }

  return {
    configPath: null,
    configName: null,
    raw: null,
  };
}
function normalizeHexColor(value, fallback) {
  if (typeof value !== 'string') {
    return fallback;
  }

  const trimmed = value.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(trimmed)) {
    return trimmed.toUpperCase();
  }
  if (/^#[0-9a-fA-F]{3}$/.test(trimmed)) {
    return `#${trimmed[1]}${trimmed[1]}${trimmed[2]}${trimmed[2]}${trimmed[3]}${trimmed[3]}`.toUpperCase();
  }
  // Expo allows 8-digit #RRGGBBAA colors. CSS background-color in this preview
  // doesn't need the alpha channel, so keep the RGB and drop AA rather than
  // silently discarding the whole value to the fallback.
  if (/^#[0-9a-fA-F]{8}$/.test(trimmed)) {
    return trimmed.slice(0, 7).toUpperCase();
  }
  return fallback;
}

function safeProjectAsset(projectRoot, relativePath) {
  if (typeof relativePath !== 'string' || !relativePath.trim()) {
    return null;
  }

  const resolvedRoot = path.resolve(projectRoot);
  const resolvedPath = path.resolve(resolvedRoot, relativePath);
  const relativeFromRoot = path.relative(resolvedRoot, resolvedPath);

  // Reject anything that escapes the project root (e.g. "../../etc/foo.png")
  // so a hostile or malformed app.json can't be used to read arbitrary files.
  if (relativeFromRoot.startsWith('..') || path.isAbsolute(relativeFromRoot)) {
    return null;
  }

  return resolvedPath;
}

function resolveAsset(projectRoot, relativePath) {
  const absolutePath = safeProjectAsset(projectRoot, relativePath);
  if (!absolutePath) {
    return {
      path: PLACEHOLDER_ICON,
      relative: 'assets/placeholder-icon.png',
      placeholder: true,
      missing: false,
    };
  }

  try {
    if (fs.existsSync(absolutePath) && fs.statSync(absolutePath).isFile()) {
      return {
        path: absolutePath,
        relative: path.relative(projectRoot, absolutePath).replace(/\\/g, '/'),
        placeholder: false,
        missing: false,
      };
    }
  } catch (error) {
    return {
      path: PLACEHOLDER_ICON,
      relative: 'assets/placeholder-icon.png',
      placeholder: true,
      missing: true,
      error: error.message,
    };
  }

  return {
    path: PLACEHOLDER_ICON,
    relative: 'assets/placeholder-icon.png',
    placeholder: true,
    missing: true,
  };
}

function buildState(projectRoot) {
  ensurePlaceholderAsset();
  const detected = detectConfig(projectRoot);
  const rawConfig = detected.raw && !detected.raw.__error ? detected.raw : {};
  const expo = rawConfig.expo || {};
  const android = expo.android || {};
  const adaptiveIcon = android.adaptiveIcon || {};
  const splash = expo.splash || {};
  const splashDark = splash.dark || {};

  const iconAsset = resolveAsset(projectRoot, adaptiveIcon.foregroundImage || expo.icon);
  const iosIconAsset = resolveAsset(projectRoot, expo.icon);
  const splashAsset = resolveAsset(projectRoot, splash.image);
  const splashDarkAsset = resolveAsset(projectRoot, splashDark.image || splash.image);

  const warningMessages = [];
  if (!detected.configPath) {
    warningMessages.push('No app.json, app.config.json, or app.config.js found. Showing placeholder assets and default colors.');
  }
  if (detected.raw && detected.raw.__error) {
    warningMessages.push(detected.raw.__error);
  }
  if (iconAsset.missing) {
    warningMessages.push('Android foreground icon was missing. Using the bundled placeholder.');
  }
  if (iosIconAsset.missing) {
    warningMessages.push('Expo icon was missing. Using the bundled placeholder for iOS.');
  }
  if (splashAsset.missing) {
    warningMessages.push('Splash image was missing. Using the bundled placeholder.');
  }

  return {
    projectRoot,
    configName: detected.configName,
    configPath: detected.configPath,
    warnings: warningMessages,
    assets: {
      icon: iconAsset,
      iosIcon: iosIconAsset,
      splash: splashAsset,
      splashDark: splashDarkAsset,
    },
    expo: {
      name: typeof expo.name === 'string' && expo.name.trim() ? expo.name.trim() : 'Your App',
      icon: expo.icon || null,
      androidForegroundImage: adaptiveIcon.foregroundImage || null,
      adaptiveBackgroundColor: normalizeHexColor(adaptiveIcon.backgroundColor, '#FFFFFF'),
      splashImage: splash.image || null,
      splashImageWidth: typeof splash.imageWidth === 'number' ? splash.imageWidth : null,
      splashBackgroundColor: normalizeHexColor(splash.backgroundColor, '#FFFFFF'),
      splashDarkBackgroundColor: normalizeHexColor(splashDark.backgroundColor, '#121212'),
      splashDarkImage: splashDark.image || null,
    },
  };
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function createHtml(state) {
  const payload = JSON.stringify({
    warnings: state.warnings,
    projectRoot: state.projectRoot,
    configName: state.configName,
    assets: {
      iconPath: state.assets.icon.relative,
      iosIconPath: state.assets.iosIcon.relative,
      splashPath: state.assets.splash.relative,
      splashDarkPath: state.assets.splashDark.relative,
    },
    expo: state.expo,
  }).replace(/</g, '\\u003c');

  const htmlTemplate = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
  const styles = fs.readFileSync(path.join(__dirname, 'style.css'), 'utf8');

  return htmlTemplate
    .replace('<style id="main-styles"></style>', `<style>\n${styles}\n  </style>`)
    .replace('{{PROJECT_ROOT}}', escapeHtml(state.projectRoot))
    .replace('{{CONFIG_NAME}}', escapeHtml(state.configName || 'Not found'))
    .replace(/\{\{EXPO_NAME\}\}/g, escapeHtml(state.expo.name))
    .replace('let STATE = {};', `let STATE = ${payload};`);
}

function openBrowser(url) {
  const command =
    process.platform === 'darwin'
      ? `open "${url}"`
      : process.platform === 'win32'
        ? `start "" "${url}"`
        : `xdg-open "${url}"`;

  exec(command, (error) => {
    if (error) {
      process.stdout.write(`Open manually: ${url}\n`);
    }
  });
}

function servePng(res, filePath) {
  fs.readFile(filePath, (error, data) => {
    if (error || !data || data.length < PNG_SIGNATURE.length || !data.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)) {
      res.writeHead(404, {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-store',
      });
      res.end('Not Found');
      return;
    }

    res.writeHead(200, {
      'Content-Type': 'image/png',
      'Cache-Control': 'no-store',
    });
    res.end(data);
  });
}

function createServer(options) {
  return http.createServer((req, res) => {
    const requestUrl = new URL(req.url, 'http://localhost');
    const state = buildState(options.projectRoot);

    if (requestUrl.pathname === '/') {
      const html = createHtml(state);
      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
      });
      res.end(html);
      return;
    }

    if (requestUrl.pathname === '/events') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      });
      res.write('\n');
      sseClients.push(res);

      req.on('close', () => {
        const index = sseClients.indexOf(res);
        if (index !== -1) {
          sseClients.splice(index, 1);
        }
      });
      return;
    }

    if (requestUrl.pathname === '/assets/icon') {
      servePng(res, state.assets.icon.path);
      return;
    }

    if (requestUrl.pathname === '/assets/ios-icon') {
      servePng(res, state.assets.iosIcon.path);
      return;
    }

    if (requestUrl.pathname === '/assets/splash') {
      servePng(res, state.assets.splash.path);
      return;
    }

    if (requestUrl.pathname === '/assets/splash-dark') {
      servePng(res, state.assets.splashDark.path);
      return;
    }

    res.writeHead(404, {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
    });
    res.end('Not Found');
  });
}

function startServer(options) {
  const server = createServer(options);
  let currentPort = options.port;
  let browserOpened = false;

  server.on('error', (error) => {
    if (error && error.code === 'EADDRINUSE') {
      currentPort += 1;
      server.listen(currentPort);
      return;
    }

    process.stderr.write(`${error.message}\n`);
    process.exit(1);
  });

  server.on('listening', () => {
    const url = `http://localhost:${currentPort}`;
    process.stdout.write(`iconpeek running at ${url}\n`);
    updateWatchers(options.projectRoot);
    if (options.open && !browserOpened) {
      browserOpened = true;
      openBrowser(url);
    }
  });

  server.listen(currentPort);
}

try {
  const options = parseArgs(process.argv.slice(2));
  startServer(options);
} catch (error) {
  process.stderr.write(`${error.message}\n\n`);
  printHelp();
  process.exit(1);
}