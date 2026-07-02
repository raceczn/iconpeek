import argparse
import base64
import io
import json
import sys
from pathlib import Path

from PIL import Image, ImageDraw


ANDROID_DENSITIES = {
    "mdpi": 48,
    "hdpi": 72,
    "xhdpi": 96,
    "xxhdpi": 144,
    "xxxhdpi": 192,
}

IOS_SIZES = [
    (20, 2),
    (20, 3),
    (29, 2),
    (29, 3),
    (40, 2),
    (40, 3),
    (60, 2),
    (60, 3),
    (76, 1),
    (76, 2),
    (83.5, 2),
    (1024, 1),
]


PLACEHOLDER_BASE64 = "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"


def parse_args():
    parser = argparse.ArgumentParser(description="Generate Android and iOS icon assets from one source image.")
    parser.add_argument("--source", help="Source icon PNG", default=None)
    parser.add_argument("--out", help="Output directory", default="icon_output")
    parser.add_argument("--android-fg", help="Foreground image for adaptive icon", default=None)
    parser.add_argument("--android-bg", help="Adaptive icon background color", default="#FFFFFF")
    parser.add_argument("--ios-source", help="Alternate source image for iOS icons", default=None)
    return parser.parse_args()


def ensure_placeholder_asset():
    return Image.open(io.BytesIO(base64.b64decode(PLACEHOLDER_BASE64))).convert("RGBA")


def ensure_repo_placeholder():
    assets_dir = Path(__file__).resolve().parent / "assets"
    placeholder_path = assets_dir / "placeholder-icon.png"
    if placeholder_path.exists():
        return

    assets_dir.mkdir(parents=True, exist_ok=True)
    ensure_placeholder_asset().save(placeholder_path)


def ensure_source_image(source_value):
    if source_value:
        source_path = Path(source_value).expanduser().resolve()
        if not source_path.exists():
            raise FileNotFoundError(f"Source image not found: {source_path}")
        return source_path

    return None


def open_image(path_value):
    return Image.open(path_value).convert("RGBA")


def flatten_to_white(image):
    background = Image.new("RGB", image.size, "#FFFFFF")
    background.paste(image, mask=image.getchannel("A") if "A" in image.getbands() else None)
    return background


def square_fit(image, size):
    return image.resize((size, size), Image.LANCZOS)


def circular_icon(image, size):
    base = image.resize((size, size), Image.LANCZOS)
    mask = Image.new("L", (size, size), 0)
    draw = ImageDraw.Draw(mask)
    draw.ellipse((0, 0, size - 1, size - 1), fill=255)
    result = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    result.paste(base, (0, 0), mask)
    return result


def centered_safe_zone(image, canvas_size):
    safe_zone_size = round(canvas_size * (66 / 108))
    resized = image.resize((safe_zone_size, safe_zone_size), Image.LANCZOS)
    canvas = Image.new("RGBA", (canvas_size, canvas_size), (0, 0, 0, 0))
    offset = ((canvas_size - safe_zone_size) // 2, (canvas_size - safe_zone_size) // 2)
    canvas.paste(resized, offset, resized)
    return canvas


def write_android_assets(source_image, foreground_image, output_root, background_color):
    android_root = output_root / "android"
    for density, px in ANDROID_DENSITIES.items():
        mipmap_dir = android_root / f"mipmap-{density}"
        mipmap_dir.mkdir(parents=True, exist_ok=True)

        square_fit(source_image, px).save(mipmap_dir / "ic_launcher.png")
        circular_icon(source_image, px).save(mipmap_dir / "ic_launcher_round.png")

        adaptive_layer_size = round(px * (108 / 72))
        Image.new("RGBA", (adaptive_layer_size, adaptive_layer_size), background_color).save(
            mipmap_dir / "ic_launcher_background.png"
        )
        centered_safe_zone(foreground_image, adaptive_layer_size).save(mipmap_dir / "ic_launcher_foreground.png")

    anydpi = android_root / "mipmap-anydpi-v26"
    anydpi.mkdir(parents=True, exist_ok=True)
    xml = """<adaptive-icon xmlns:android=\"http://schemas.android.com/apk/res/android\">
    <background android:drawable=\"@mipmap/ic_launcher_background\" />
    <foreground android:drawable=\"@mipmap/ic_launcher_foreground\" />
</adaptive-icon>
"""
    (anydpi / "ic_launcher.xml").write_text(xml, encoding="utf-8")
    (anydpi / "ic_launcher_round.xml").write_text(xml, encoding="utf-8")

    play_store_dir = android_root / "play-store"
    play_store_dir.mkdir(parents=True, exist_ok=True)
    flatten_to_white(square_fit(source_image, 512)).save(play_store_dir / "play_store_icon.png")


def write_ios_assets(ios_image, output_root):
    appiconset = output_root / "ios" / "AppIcon.appiconset"
    appiconset.mkdir(parents=True, exist_ok=True)

    images = []
    for points, scale in IOS_SIZES:
        size_px = int(round(points * scale))
        filename = f"icon_{points}x{points}@{scale}x.png"
        if float(points).is_integer():
            filename = f"icon_{int(points)}x{int(points)}@{scale}x.png"

        flatten_to_white(square_fit(ios_image, size_px)).save(appiconset / filename)
        images.append(
            {
                "size": f"{points}x{points}",
                "idiom": "iphone" if points not in (76, 83.5, 1024) else ("ios-marketing" if points == 1024 else "ipad"),
                "filename": filename,
                "scale": f"{scale}x",
            }
        )

    contents = {"images": images, "info": {"version": 1, "author": "xcode"}}
    (appiconset / "Contents.json").write_text(json.dumps(contents, indent=2), encoding="utf-8")


def warn_about_source(image, label):
    width, height = image.size
    if width != height:
        print(f"Warning: {label} is not square ({width}x{height}). Output will be forced to square.", file=sys.stderr)
    if width < 1024 or height < 1024:
        print(f"Warning: {label} is smaller than 1024x1024. Upscaling will reduce quality.", file=sys.stderr)


def main():
    args = parse_args()
    ensure_repo_placeholder()
    source_path = ensure_source_image(args.source)
    if source_path is None:
        print("Error: --source is required for icon generation.", file=sys.stderr)
        return 1

    output_root = Path(args.out).expanduser().resolve()
    output_root.mkdir(parents=True, exist_ok=True)

    source_image = open_image(source_path)
    android_fg_image = open_image(Path(args.android_fg).expanduser().resolve()) if args.android_fg else source_image
    ios_source_image = open_image(Path(args.ios_source).expanduser().resolve()) if args.ios_source else source_image

    warn_about_source(source_image, "source image")
    if args.android_fg:
        warn_about_source(android_fg_image, "android foreground image")
    if args.ios_source:
        warn_about_source(ios_source_image, "iOS source image")

    write_android_assets(source_image, android_fg_image, output_root, args.android_bg)
    write_ios_assets(ios_source_image, output_root)

    print(f"Generated icon assets in {output_root}")
    return 0


if __name__ == "__main__":
    sys.exit(main())