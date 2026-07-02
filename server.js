#!/usr/bin/env node

const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const DEFAULT_PORT = 4200;
const PLACEHOLDER_ICON = path.join(__dirname, 'assets', 'placeholder-icon.png');
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

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

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>iconpeek</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #0c0c0e;
      --surface: #18181b;
      --card: #1f1f23;
      --border: #2e2e35;
      --accent: #f97316;
      --text: #fafafa;
      --muted: #71717a;
      --green: #22c55e;
      --red: #ef4444;
    }

    * { box-sizing: border-box; }

    body {
      margin: 0;
      font-family: 'Inter', sans-serif;
      color: var(--text);
      background:
        radial-gradient(circle at top left, rgba(249,115,22,0.12), transparent 22%),
        radial-gradient(circle at top right, rgba(34,197,94,0.08), transparent 20%),
        linear-gradient(180deg, #101014 0%, var(--bg) 18%, #09090b 100%);
      min-height: 100vh;
    }

    a { color: inherit; }

    .header {
      position: sticky;
      top: 0;
      z-index: 100;
      display: flex;
      justify-content: space-between;
      gap: 1rem;
      align-items: center;
      padding: 1rem 1.5rem;
      background: rgba(12, 12, 14, 0.72);
      border-bottom: 1px solid rgba(46, 46, 53, 0.8);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
    }

    .brand {
      display: flex;
      gap: 0.9rem;
      align-items: center;
    }

    .brand-mark {
      width: 12px;
      height: 12px;
      border-radius: 999px;
      background: linear-gradient(135deg, #fb923c, #f97316);
      box-shadow: 0 0 24px rgba(249,115,22,0.5);
    }

    .brand-title {
      margin: 0;
      font-size: 1.1rem;
      font-weight: 800;
      letter-spacing: -0.03em;
    }

    .brand-copy {
      margin: 0.15rem 0 0;
      color: var(--muted);
      font-size: 0.78rem;
    }

    .header-pill {
      padding: 0.45rem 0.8rem;
      border-radius: 999px;
      border: 1px solid rgba(249,115,22,0.3);
      background: rgba(249,115,22,0.1);
      color: var(--accent);
      font-size: 0.72rem;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      font-weight: 700;
      white-space: nowrap;
    }

    .page {
      max-width: 1320px;
      margin: 0 auto;
      padding: 1.5rem;
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
    }

    .summary {
      display: grid;
      grid-template-columns: minmax(0, 1.4fr) minmax(320px, 0.8fr);
      gap: 1rem;
    }

    .hero {
      padding: 1.3rem 1.4rem;
      border-radius: 16px;
      border: 1px solid var(--border);
      background:
        linear-gradient(135deg, rgba(249,115,22,0.14), rgba(24,24,27,0.92) 36%),
        var(--card);
      box-shadow: 0 24px 60px rgba(0,0,0,0.25);
    }

    .hero h2 {
      margin: 0;
      font-size: clamp(1.5rem, 3vw, 2.2rem);
      letter-spacing: -0.04em;
    }

    .hero p {
      margin: 0.75rem 0 0;
      color: #d4d4d8;
      max-width: 62ch;
      line-height: 1.55;
    }

    .meta-card, .card {
      background: rgba(31,31,35,0.92);
      border: 1px solid var(--border);
      border-radius: 16px;
      box-shadow: 0 18px 48px rgba(0,0,0,0.22);
    }

    .meta-card {
      padding: 1.15rem;
      display: flex;
      flex-direction: column;
      gap: 0.8rem;
    }

    .meta-label {
      color: var(--muted);
      text-transform: uppercase;
      letter-spacing: 0.07em;
      font-size: 0.72rem;
      font-weight: 700;
    }

    .meta-value {
      font-size: 0.95rem;
      word-break: break-word;
    }

    .warning-banner {
      display: none;
      padding: 0.9rem 1rem;
      border-radius: 14px;
      border: 1px solid rgba(239,68,68,0.3);
      background: rgba(127,29,29,0.24);
      color: #fecaca;
      line-height: 1.45;
    }

    .grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 1.5rem;
    }

    .card {
      padding: 1.25rem;
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .card-head {
      display: flex;
      justify-content: space-between;
      gap: 0.75rem;
      align-items: center;
      flex-wrap: wrap;
    }

    .card-title {
      margin: 0;
      color: var(--muted);
      text-transform: uppercase;
      letter-spacing: 0.07em;
      font-size: 0.78rem;
      font-weight: 700;
    }

    .hint {
      color: #d4d4d8;
      font-size: 0.84rem;
      line-height: 1.5;
    }

    .controls {
      display: flex;
      flex-wrap: wrap;
      gap: 0.75rem;
      align-items: center;
    }

    .segment {
      display: inline-flex;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 10px;
      overflow: hidden;
    }

    .segment button {
      border: 0;
      background: transparent;
      color: var(--muted);
      padding: 0.55rem 0.85rem;
      font: inherit;
      font-size: 0.82rem;
      cursor: pointer;
      transition: background 160ms ease, color 160ms ease;
    }

    .segment button.active {
      background: var(--accent);
      color: white;
    }

    .segment button + button {
      border-left: 1px solid var(--border);
    }

    .toggle {
      display: inline-flex;
      align-items: center;
      gap: 0.45rem;
      color: #d4d4d8;
      font-size: 0.82rem;
    }

    .toggle input {
      accent-color: var(--accent);
    }

    .stage {
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 360px;
      padding: 1rem;
      border-radius: 14px;
      background:
        radial-gradient(circle at top, rgba(249,115,22,0.12), transparent 38%),
        linear-gradient(180deg, rgba(24,24,27,0.95), rgba(12,12,14,0.96));
      border: 1px solid rgba(46,46,53,0.9);
    }

    .adaptive-wrap {
      display: flex;
      flex-direction: column;
      gap: 0.9rem;
      align-items: center;
    }

    .adaptive-mask {
      width: 216px;
      height: 216px;
      position: relative;
      overflow: hidden;
      box-shadow: 0 16px 44px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.04);
      background: #fff;
      transition: border-radius 220ms ease, clip-path 220ms ease;
    }

    .mask-squircle {
      clip-path: path('M108,0 C173,0 216,43 216,108 C216,173 173,216 108,216 C43,216 0,173 0,108 C0,43 43,0 108,0 Z');
      border-radius: 0;
    }

    .mask-rounded { border-radius: 48px; clip-path: none; }
    .mask-circle { border-radius: 50%; clip-path: none; }
    .mask-square { border-radius: 0; clip-path: none; }

    .adaptive-layer {
      position: absolute;
      width: 324px;
      height: 324px;
      left: -54px;
      top: -54px;
    }

    .adaptive-bg {
      background: #FFFFFF;
    }

    .adaptive-fg {
      background-position: center;
      background-repeat: no-repeat;
      background-size: contain;
      will-change: transform;
      transition: transform 80ms ease-out;
    }

    .safe-zone {
      position: absolute;
      left: 9px;
      top: 9px;
      width: 198px;
      height: 198px;
      border-radius: 50%;
      border: 2px dashed rgba(239,68,68,0.9);
      z-index: 3;
      display: none;
      pointer-events: none;
    }

    .safe-zone span {
      position: absolute;
      top: -1.6rem;
      left: 50%;
      transform: translateX(-50%);
      font-size: 0.68rem;
      color: #fca5a5;
      font-weight: 700;
      white-space: nowrap;
    }

    .shape-caption {
      color: var(--muted);
      font-size: 0.82rem;
      text-align: center;
    }

    .spec-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 0.75rem;
    }

    .spec-pill {
      padding: 0.75rem 0.85rem;
      border-radius: 12px;
      background: var(--surface);
      border: 1px solid var(--border);
    }

    .spec-pill strong {
      display: block;
      font-size: 0.68rem;
      text-transform: uppercase;
      letter-spacing: 0.07em;
      color: var(--muted);
      margin-bottom: 0.28rem;
    }

    .spec-pill span {
      font-size: 0.93rem;
      font-weight: 600;
    }

    .size-row {
      display: flex;
      justify-content: center;
      gap: 1.2rem;
      flex-wrap: wrap;
      padding: 1rem;
      border-radius: 14px;
      background: var(--surface);
      border: 1px solid rgba(46,46,53,0.9);
    }

    .size-item {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.45rem;
    }

    .size-label {
      color: var(--muted);
      font-size: 0.73rem;
      line-height: 1.3;
      text-align: center;
    }

    .mini-mask, .launcher-mask {
      position: relative;
      overflow: hidden;
      background: #fff;
      box-shadow: 0 10px 20px rgba(0,0,0,0.35);
    }

    .mini-bg, .mini-fg, .launcher-bg, .launcher-fg {
      position: absolute;
      background-position: center;
      background-repeat: no-repeat;
      background-size: contain;
    }

    .ios-preview {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 1rem;
      padding: 1rem;
      border-radius: 14px;
      background: linear-gradient(180deg, rgba(24,24,27,0.95), rgba(12,12,14,0.96));
      border: 1px solid rgba(46,46,53,0.9);
    }

    .ios-mask {
      width: 216px;
      height: 216px;
      border-radius: 47px;
      overflow: hidden;
      background: #fff;
      box-shadow: 0 16px 44px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.04);
    }

    .ios-mask img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }

    .context {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 1.5rem;
    }

    .screen {
      border-radius: 16px;
      padding: 1rem;
      overflow: hidden;
      position: relative;
      min-height: 250px;
    }

    .android-screen {
      background: linear-gradient(155deg, #231942, #1d3557 55%, #0b1020);
    }

    .ios-screen {
      background: linear-gradient(160deg, #11324d, #0b1c2d 55%, #191936);
    }

    .screen::before {
      content: '';
      position: absolute;
      inset: 0;
      background:
        radial-gradient(circle at 20% 10%, rgba(255,255,255,0.06), transparent 18%),
        radial-gradient(circle at 80% 40%, rgba(255,255,255,0.06), transparent 20%);
      pointer-events: none;
    }

    .screen-grid {
      position: relative;
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 0.8rem;
      align-items: start;
      justify-items: center;
      z-index: 1;
    }

    .app-chip {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.4rem;
      width: 100%;
    }

    .app-label {
      width: 100%;
      text-align: center;
      color: rgba(255,255,255,0.92);
      text-shadow: 0 1px 3px rgba(0,0,0,0.6);
      font-size: 0.7rem;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .placeholder {
      width: 96px;
      height: 96px;
      border-radius: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.7rem;
      box-shadow: 0 10px 20px rgba(0,0,0,0.35);
    }

    .ios-placeholder {
      border-radius: 21px;
    }

    .ring {
      box-shadow: 0 0 0 3px rgba(249,115,22,0.95), 0 10px 20px rgba(0,0,0,0.35);
    }

    .splash-pair {
      display: flex;
      justify-content: center;
      gap: 1.4rem;
      flex-wrap: wrap;
    }

    .phone {
      width: 200px;
      height: 420px;
      border-radius: 34px;
      border: 7px solid #232329;
      overflow: hidden;
      position: relative;
      box-shadow: 0 22px 60px rgba(0,0,0,0.45), inset 0 0 0 1px rgba(255,255,255,0.04);
      background: #000;
    }

    .notch {
      position: absolute;
      top: 0;
      left: 50%;
      transform: translateX(-50%);
      width: 82px;
      height: 14px;
      border-bottom-left-radius: 10px;
      border-bottom-right-radius: 10px;
      background: #18181b;
      z-index: 3;
    }

    .statusbar {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 26px;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      padding: 0 14px 4px;
      font-size: 0.62rem;
      font-weight: 700;
      z-index: 4;
    }

    .splash-surface {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .splash-image {
      width: 38%;
      height: auto;
      object-fit: contain;
    }

    .theme-chip {
      position: absolute;
      bottom: 15px;
      left: 50%;
      transform: translateX(-50%);
      padding: 0.28rem 0.7rem;
      border-radius: 999px;
      font-size: 0.64rem;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      font-weight: 700;
    }

    .theme-chip.light {
      color: rgba(0,0,0,0.52);
      background: rgba(0,0,0,0.08);
    }

    .theme-chip.dark {
      color: rgba(255,255,255,0.72);
      background: rgba(255,255,255,0.08);
    }

    .footnote {
      color: var(--muted);
      font-size: 0.78rem;
      line-height: 1.5;
    }

    @media (max-width: 900px) {
      .summary, .grid, .context {
        grid-template-columns: 1fr;
      }

      .header {
        padding: 1rem;
      }

      .page {
        padding: 1rem;
      }

      .spec-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }

    @media (max-width: 640px) {
      .spec-grid {
        grid-template-columns: 1fr;
      }

      .screen-grid {
        grid-template-columns: repeat(2, 1fr);
      }
    }
  </style>
</head>
<body>
  <header class="header">
    <div class="brand">
      <div class="brand-mark"></div>
      <div>
        <h1 class="brand-title">iconpeek</h1>
        <p class="brand-copy">Local Expo icon and splash previewer</p>
      </div>
    </div>
    <div class="header-pill">Zero Dependencies</div>
  </header>

  <main class="page">
    <section class="summary">
      <div class="hero">
        <h2>Preview Android adaptive icons, iOS icons, and splash screens without a native build.</h2>
        <p>iconpeek reads your Expo config directly, mirrors Android adaptive icon canvas and safe-zone math, and gives you instant browser feedback while you tweak assets in your project.</p>
      </div>
      <aside class="meta-card">
        <div>
          <div class="meta-label">Project Root</div>
          <div class="meta-value">${escapeHtml(state.projectRoot)}</div>
        </div>
        <div>
          <div class="meta-label">Config Source</div>
          <div class="meta-value">${escapeHtml(state.configName || 'Not found')}</div>
        </div>
        <div>
          <div class="meta-label">App Label</div>
          <div class="meta-value" id="appLabelMeta">${escapeHtml(state.expo.name)}</div>
        </div>
      </aside>
    </section>

    <section class="warning-banner" id="warningBanner"></section>

    <section class="grid">
      <article class="card">
        <div class="card-head">
          <h3 class="card-title">Android Adaptive Icon Simulator</h3>
          <div class="controls">
            <div class="segment" id="shapeControl">
              <button type="button" data-shape="squircle" class="active">Squircle</button>
              <button type="button" data-shape="rounded">Rounded</button>
              <button type="button" data-shape="circle">Circle</button>
              <button type="button" data-shape="square">Square</button>
            </div>
            <label class="toggle">
              <input type="checkbox" id="safeZoneToggle">
              Show safe zone
            </label>
          </div>
        </div>

        <div class="stage">
          <div class="adaptive-wrap">
            <div class="adaptive-mask mask-squircle" id="adaptiveMask">
              <div class="adaptive-layer adaptive-bg" id="adaptiveBg"></div>
              <div class="adaptive-layer adaptive-fg" id="adaptiveFg"></div>
              <div class="safe-zone" id="safeZone">
                <span>66dp Safe Zone</span>
              </div>
            </div>
            <div class="shape-caption" id="shapeCaption">Android 12+ default squircle mask</div>
          </div>
        </div>

        <div class="spec-grid">
          <div class="spec-pill"><strong>Layer Canvas</strong><span>108dp / 324px</span></div>
          <div class="spec-pill"><strong>Visible Mask</strong><span>72dp / 216px</span></div>
          <div class="spec-pill"><strong>Safe Zone</strong><span>66dp / 198px</span></div>
          <div class="spec-pill"><strong>BG Color</strong><span id="bgColorValue">#FFFFFF</span></div>
          <div class="spec-pill"><strong>Crop Margin</strong><span>18dp / 54px</span></div>
          <div class="spec-pill"><strong>Preview Scale</strong><span>3x</span></div>
        </div>

        <div class="size-row" id="androidSizeRow"></div>
      </article>

      <article class="card">
        <div class="card-head">
          <h3 class="card-title">iOS Icon Preview</h3>
          <div class="header-pill" style="padding:0.35rem 0.65rem;font-size:0.66rem;">Flat Asset</div>
        </div>
        <div class="ios-preview">
          <div class="ios-mask">
            <img src="/assets/ios-icon" alt="iOS app icon">
          </div>
          <div class="hint">iOS app icons should be opaque; this preview approximates the system mask so you can judge edge composition quickly.</div>
        </div>
        <div class="size-row" id="iosSizeRow"></div>
      </article>
    </section>

    <section class="context">
      <article class="card">
        <div class="card-head">
          <h3 class="card-title">Android Launcher Context</h3>
          <div class="hint">96x96 highlight ring in a mock launcher grid</div>
        </div>
        <div class="screen android-screen">
          <div class="screen-grid">
            <div class="app-chip">
              <div class="placeholder" style="background:linear-gradient(135deg,#2563eb,#38bdf8)">MSG</div>
              <div class="app-label">Messages</div>
            </div>
            <div class="app-chip">
              <div class="launcher-mask ring mask-squircle" id="launcherMask" style="width:96px;height:96px;">
                <div class="launcher-bg" id="launcherBg"></div>
                <div class="launcher-fg" id="launcherFg"></div>
              </div>
              <div class="app-label" id="androidAppLabel">${escapeHtml(state.expo.name)}</div>
            </div>
            <div class="app-chip">
              <div class="placeholder" style="background:linear-gradient(135deg,#16a34a,#4ade80)">IMG</div>
              <div class="app-label">Gallery</div>
            </div>
            <div class="app-chip">
              <div class="placeholder" style="background:linear-gradient(135deg,#9333ea,#c084fc)">AUD</div>
              <div class="app-label">Music</div>
            </div>
          </div>
        </div>
      </article>

      <article class="card">
        <div class="card-head">
          <h3 class="card-title">iOS Homescreen Context</h3>
          <div class="hint">96x96 highlight ring in a mock homescreen grid</div>
        </div>
        <div class="screen ios-screen">
          <div class="screen-grid">
            <div class="app-chip">
              <div class="placeholder ios-placeholder" style="background:linear-gradient(135deg,#0ea5e9,#67e8f9)">TEL</div>
              <div class="app-label">Phone</div>
            </div>
            <div class="app-chip">
              <div class="ios-placeholder ring" style="width:96px;height:96px;border-radius:21px;overflow:hidden;background:#fff;">
                <img src="/assets/ios-icon" alt="iOS homescreen icon" style="width:100%;height:100%;object-fit:cover;display:block;">
              </div>
              <div class="app-label" id="iosAppLabel">${escapeHtml(state.expo.name)}</div>
            </div>
            <div class="app-chip">
              <div class="placeholder ios-placeholder" style="background:linear-gradient(135deg,#f59e0b,#fcd34d)">SET</div>
              <div class="app-label">Settings</div>
            </div>
            <div class="app-chip">
              <div class="placeholder ios-placeholder" style="background:linear-gradient(135deg,#dc2626,#fb7185)">HLT</div>
              <div class="app-label">Health</div>
            </div>
          </div>
        </div>
      </article>
    </section>

    <section class="card">
      <div class="card-head">
        <h3 class="card-title">Splash Screen Preview</h3>
        <div class="hint">Light and dark frames with auto-inverted status bar text based on background luminance</div>
      </div>
      <div class="splash-pair">
        <div class="phone">
          <div class="notch"></div>
          <div class="statusbar" id="statusbarLight">
            <span>9:41</span>
            <span>||| 100%</span>
          </div>
          <div class="splash-surface" id="splashLightSurface">
            <img class="splash-image" src="/assets/splash" alt="Light splash preview">
            <div class="theme-chip light">Light Mode</div>
          </div>
        </div>
        <div class="phone">
          <div class="notch"></div>
          <div class="statusbar" id="statusbarDark">
            <span>9:41</span>
            <span>||| 100%</span>
          </div>
          <div class="splash-surface" id="splashDarkSurface">
            <img class="splash-image" src="/assets/splash-dark" alt="Dark splash preview">
            <div class="theme-chip dark">Dark Mode</div>
          </div>
        </div>
      </div>
      <div class="footnote" id="splashFootnote">Splash image width defaults to 38% of the frame width unless imageWidth is set in Expo config.</div>
    </section>
  </main>

  <script>
    const STATE = ${payload};
    const shapeMap = {
      squircle: { className: 'mask-squircle', caption: 'Android 12+ default squircle mask' },
      rounded: { className: 'mask-rounded', caption: 'Rounded rectangle mask' },
      circle: { className: 'mask-circle', caption: 'Circle mask' },
      square: { className: 'mask-square', caption: 'Square mask' }
    };
    const maskClasses = Object.values(shapeMap).map((entry) => entry.className);
    const androidSizes = [
      { px: 36, label: 'Status bar', dp: '24dp' },
      { px: 54, label: 'Notification', dp: '36dp' },
      { px: 72, label: 'Launcher', dp: '48dp' },
      { px: 96, label: 'App drawer', dp: '64dp' }
    ];
    const iosSizes = [
      { px: 40, label: 'Settings', pt: '29pt' },
      { px: 57, label: 'Spotlight', pt: '40pt' },
      { px: 86, label: 'Home Screen', pt: '60pt' },
      { px: 128, label: 'App Store display', pt: '1024px source' }
    ];

    function isDarkColor(hex) {
      const normalized = (hex || '#FFFFFF').replace('#', '');
      const expanded = normalized.length === 3
        ? normalized.split('').map((char) => char + char).join('')
        : normalized;
      const r = parseInt(expanded.slice(0, 2), 16);
      const g = parseInt(expanded.slice(2, 4), 16);
      const b = parseInt(expanded.slice(4, 6), 16);
      return (0.299 * r + 0.587 * g + 0.114 * b) < 128;
    }

    function buildAndroidSizeRow() {
      const container = document.getElementById('androidSizeRow');
      container.innerHTML = '';
      const bgColor = STATE.expo.adaptiveBackgroundColor;
      androidSizes.forEach((item) => {
        const mask = document.createElement('div');
        mask.className = 'mini-mask mask-squircle';
        mask.style.width = item.px + 'px';
        mask.style.height = item.px + 'px';

        const layerSize = item.px * (108 / 72);
        const offset = (layerSize - item.px) / 2;

        const bg = document.createElement('div');
        bg.className = 'mini-bg';
        bg.style.width = layerSize + 'px';
        bg.style.height = layerSize + 'px';
        bg.style.left = (-offset) + 'px';
        bg.style.top = (-offset) + 'px';
        bg.style.backgroundColor = bgColor;

        const fg = document.createElement('div');
        fg.className = 'mini-fg';
        fg.style.width = layerSize + 'px';
        fg.style.height = layerSize + 'px';
        fg.style.left = (-offset) + 'px';
        fg.style.top = (-offset) + 'px';
        fg.style.backgroundImage = "url('/assets/icon')";

        mask.appendChild(bg);
        mask.appendChild(fg);

        const itemNode = document.createElement('div');
        itemNode.className = 'size-item';
        itemNode.appendChild(mask);

        const label = document.createElement('div');
        label.className = 'size-label';
        label.innerHTML = item.px + '&times;' + item.px + 'px<br>' + item.dp + ' ' + item.label;
        itemNode.appendChild(label);

        container.appendChild(itemNode);
      });
    }

    function buildIosSizeRow() {
      const container = document.getElementById('iosSizeRow');
      container.innerHTML = '';
      iosSizes.forEach((item) => {
        const itemNode = document.createElement('div');
        itemNode.className = 'size-item';

        const mask = document.createElement('div');
        mask.style.width = item.px + 'px';
        mask.style.height = item.px + 'px';
        mask.style.borderRadius = Math.round(item.px * 0.2237) + 'px';
        mask.style.overflow = 'hidden';
        mask.style.background = '#fff';
        mask.style.boxShadow = '0 10px 20px rgba(0,0,0,0.35)';

        const img = document.createElement('img');
        img.src = '/assets/ios-icon';
        img.alt = item.label;
        img.style.width = '100%';
        img.style.height = '100%';
        img.style.objectFit = 'cover';
        img.style.display = 'block';
        mask.appendChild(img);

        const label = document.createElement('div');
        label.className = 'size-label';
        label.innerHTML = item.px + '&times;' + item.px + 'px<br>' + item.pt;

        itemNode.appendChild(mask);
        itemNode.appendChild(label);
        container.appendChild(itemNode);
      });
    }

    function setShape(shape) {
      const mapping = shapeMap[shape] || shapeMap.squircle;
      const adaptiveMask = document.getElementById('adaptiveMask');
      const launcherMask = document.getElementById('launcherMask');

      [adaptiveMask, launcherMask].forEach((element) => {
        maskClasses.forEach((className) => element.classList.remove(className));
        element.classList.add(mapping.className);
      });

      document.getElementById('shapeCaption').textContent = mapping.caption;
      document.querySelectorAll('#shapeControl button').forEach((button) => {
        button.classList.toggle('active', button.dataset.shape === shape);
      });
    }

    function applyState() {
      const warnings = STATE.warnings || [];
      const warningBanner = document.getElementById('warningBanner');
      if (warnings.length) {
        warningBanner.style.display = 'block';
        warningBanner.innerHTML = warnings.map((warning) => '<div>' + warning + '</div>').join('');
      }

      document.getElementById('adaptiveBg').style.backgroundColor = STATE.expo.adaptiveBackgroundColor;
      document.getElementById('launcherBg').style.backgroundColor = STATE.expo.adaptiveBackgroundColor;
      document.getElementById('bgColorValue').textContent = STATE.expo.adaptiveBackgroundColor;

      document.getElementById('adaptiveFg').style.backgroundImage = "url('/assets/icon')";
      document.getElementById('launcherFg').style.backgroundImage = "url('/assets/icon')";

      document.getElementById('splashLightSurface').style.backgroundColor = STATE.expo.splashBackgroundColor;
      document.getElementById('splashDarkSurface').style.backgroundColor = STATE.expo.splashDarkBackgroundColor;
      document.getElementById('statusbarLight').style.color = isDarkColor(STATE.expo.splashBackgroundColor) ? '#FFFFFF' : '#000000';
      document.getElementById('statusbarDark').style.color = isDarkColor(STATE.expo.splashDarkBackgroundColor) ? '#FFFFFF' : '#000000';
      if (STATE.expo.splashImageWidth) {
        document.querySelectorAll('.splash-image').forEach((image) => {
          image.style.width = Math.max(24, Math.min(70, (STATE.expo.splashImageWidth / 200) * 100)) + '%';
        });
        document.getElementById('splashFootnote').textContent = 'Splash image width reflects Expo imageWidth: ' + STATE.expo.splashImageWidth + 'px.';
      }

      buildAndroidSizeRow();
      buildIosSizeRow();
    }

    document.getElementById('shapeControl').addEventListener('click', (event) => {
      if (event.target.tagName === 'BUTTON') {
        setShape(event.target.dataset.shape);
      }
    });

    document.getElementById('safeZoneToggle').addEventListener('change', (event) => {
      document.getElementById('safeZone').style.display = event.target.checked ? 'block' : 'none';
    });

    const adaptiveMask = document.getElementById('adaptiveMask');
    adaptiveMask.addEventListener('mousemove', (event) => {
      const rect = adaptiveMask.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      const dx = ((x / rect.width) - 0.5) * 32;
      const dy = ((y / rect.height) - 0.5) * 32;
      document.getElementById('adaptiveFg').style.transform = 'translate3d(' + dx.toFixed(2) + 'px,' + dy.toFixed(2) + 'px,0)';
    });
    adaptiveMask.addEventListener('mouseleave', () => {
      document.getElementById('adaptiveFg').style.transform = 'translate3d(0,0,0)';
    });

    const launcherBg = document.getElementById('launcherBg');
    const launcherFg = document.getElementById('launcherFg');
    launcherBg.style.width = '144px';
    launcherBg.style.height = '144px';
    launcherBg.style.left = '-24px';
    launcherBg.style.top = '-24px';
    launcherFg.style.width = '144px';
    launcherFg.style.height = '144px';
    launcherFg.style.left = '-24px';
    launcherFg.style.top = '-24px';

    setShape('squircle');
    applyState();
  </script>
</body>
</html>`;
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