# iconpeek

`iconpeek` is a zero-dependency local preview server for Expo app branding. It solves the slow feedback loop of changing app config, rebuilding native shells, and reinstalling just to see whether your adaptive icon crop, iOS icon mask, or splash colors are in the right neighborhood.

It is useful for React Native apps that use Expo config, including Expo-managed apps and many prebuild projects. Bare React Native support is not complete yet because native icon sources can live in Android resource folders, iOS asset catalogs, Gradle files, Xcode project settings, and third-party tooling.

## Quick Start

Run this inside your Expo project:

```bash
npx iconpeek
```

You can also point it at another project root or choose a starting port:

```bash
npx iconpeek --project /path/to/expo/app
npx iconpeek --port 5000
```

## CLI Flags

- `--project <path>`: Read `app.json`, `app.config.json`, or `app.config.js` from a different Expo project root.
- `--port <number>`: Set the starting port. `iconpeek` defaults to `4200` and auto-increments if that port is already in use.
- `--no-open`: Start the server without opening a browser window.

## What It Previews

- Android adaptive icon mask math using the 108dp canvas, 72dp viewport, 18dp crop margin, and 66dp safe zone used by adaptive icons
- Android mask shape toggles for squircle, rounded rectangle, circle, and square
- Android foreground-only parallax movement to simulate launcher depth
- iOS icon preview with an approximate system rounded mask and transparency warning
- Android launcher and iOS homescreen context previews with the selected app icon highlighted
- Android and iOS size comparison rows for common system contexts
- Splash screen previews for light and dark themes with automatic status bar contrast

## `app.json` Field Mapping

`iconpeek` reads these keys:

```json
{
  "expo": {
    "icon": "./assets/icon.png",
    "android": {
      "adaptiveIcon": {
        "foregroundImage": "./assets/adaptive-icon.png",
        "backgroundColor": "#FFFFFF"
      }
    },
    "splash": {
      "image": "./assets/splash.png",
      "imageWidth": 160,
      "backgroundColor": "#FFFFFF",
      "dark": {
        "image": "./assets/splash-dark.png",
        "backgroundColor": "#121212"
      }
    }
  }
}
```

If the config file is missing or any asset path does not exist, `iconpeek` falls back to `assets/placeholder-icon.png` and shows a warning in the UI instead of crashing.

For `app.config.js`, `iconpeek` loads the local config module directly. That matches normal Expo expectations, but it also means config code can run.

## `generate_icons.py` Usage

Install the only Python dependency:

```bash
pip install Pillow
```

Basic usage:

```bash
python generate_icons.py --source icon-1024.png --out ./icon_output
```

All supported flags:

```bash
python generate_icons.py \
  --source icon-1024.png \
  --out ./icon_output \
  --android-fg adaptive-fg.png \
  --android-bg "#F5A623" \
  --ios-source ios-flat.png
```

Flags:

- `--source`: Required base icon image used for Android legacy icons and, by default, every other output.
- `--out`: Output directory. Defaults to `./icon_output`.
- `--android-fg`: Optional dedicated Android adaptive foreground asset.
- `--android-bg`: Optional Android adaptive icon background color. Defaults to `#FFFFFF`.
- `--ios-source`: Optional alternate flat source used only for iOS icons.

The generator creates:

- Android legacy launcher icons per density
- Android adaptive foreground and background layers plus `mipmap-anydpi-v26` XML files
- A 512x512 Play Store icon flattened onto white
- A complete iOS `AppIcon.appiconset` with `Contents.json`

The script warns when a source image is not square or is smaller than `1024x1024`.

## Publishing To npm

For contributors publishing a new release:

```bash
npm version patch
npm publish
```

Make sure `server.js`, `generate_icons.py`, `README.md`, `LICENSE`, and `assets/` are included in the package before publishing.

## Contributing

Ideas for future additions:

- Bare React Native config path support outside Expo
- Android 13 monochrome icon preview and export
- watchOS and additional Apple platform icon size generation

