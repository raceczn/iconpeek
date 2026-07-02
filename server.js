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
      if (!value || !/^\d+$/.test(value)) {
        throw new Error('Missing or invalid value for --port');
      }
      options.port = Number(value);
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
    return {
      __error: `Failed to load ${path.basename(filePath)}: ${error.message}`,
    };
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
  return fallback;
}

function safeProjectAsset(projectRoot, relativePath) {
  if (typeof relativePath !== 'string' || !relativePath.trim()) {
    return null;
  }
  return path.resolve(projectRoot, relativePath);
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
      <div class="footnote">Splash image width defaults to 38% of the frame width unless imageWidth is set in Expo config.</div>
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

