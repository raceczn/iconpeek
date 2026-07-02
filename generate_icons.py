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

# (points, scale, idiom) tuples matching Apple's real AppIcon.appiconset
# requirements. Previously this only emitted "iphone" or "ipad" per *size*,
# which silently dropped the iPad entries for 20/29/40pt that Xcode expects
# alongside the iPhone ones at the same point size.
IOS_ICONS = [
    (20, 2, "iphone"),
    (20, 3, "iphone"),
    (29, 2, "iphone"),
    (29, 3, "iphone"),
    (40, 2, "iphone"),
    (40, 3, "iphone"),
    (60, 2, "iphone"),
    (60, 3, "iphone"),
    (20, 1, "ipad"),
    (20, 2, "ipad"),
    (29, 1, "ipad"),
    (29, 2, "ipad"),
    (40, 1, "ipad"),
    (40, 2, "ipad"),
    (76, 1, "ipad"),
    (76, 2, "ipad"),
    (83.5, 2, "ipad"),
    (1024, 1, "ios-marketing"),
]


PLACEHOLDER_BASE64 = "iVBORw0KGgoAAAANSUhEUgAAAgAAAAIACAYAAAD0eNT6AAARwElEQVR4nO3dQXLkxrWGUUghr8PrUnjgNfRIEVqAIzTqNXjg0Lq8Dg/0Bv0oFdlFslAAMu/N/5yxbQEJIu9XWaT8w8ZQX778+sfsawCo6OvXf/0w+xqSWOwLGPIA5xIH57OgBxn2AHOIgmMs3k4GPkBNgmAfi/UAQx+gFzHwOQt0h4EPsBZB8D0LcsPgB1ibEPhL/EIY+gCZ0mMg9uYNfgC2LTcE4m7a4AfgnrQQiLhZQx+APRJiYOkbNPgBOGLlEPhx9gVcxfAH4KiVZ8lyZbPywwJgntVOA5a5GYMfgBFWCYH2N2HwAzBD9xBo/TsAhj8As3SfQS3rpfuiA7CWjqcB7U4ADH8Aquk4m1oFQMcFBiBDtxnV4sii26ICkK3DVwLlTwAMfwC66TC7SgdAhwUEgHuqz7CSRxTVFw0A9qj4lUC5EwDDH4DVVJxtpQKg4gIBwBmqzbgyAVBtYQDgbJVmXYkAqLQgAHClKjNvegBUWQgAGKXC7JsaABUWAABmmD0DpwXA7BsHgNlmzsIpAWD4A8A3s2bi8AAw/AHgtRmzcWgAGP4AcN/oGTksAAx/APjYyFk5JAAMfwB4zKiZeXkAGP4AsM+I2XlpABj+APCcq2fo9H8TIAAw3mUB4NM/ABxz5Sy9JAAMfwA4x1Uz9fQAMPwB4FxXzFa/AwAAgU4NAJ/+AeAaZ8/Y0wLA8AeAa505a08JAMMfAMY4a+b6HQAACHQ4AHz6B4Cxzpi9hwLA8AeAOY7OYF8BAECgpwPAp38AmOvILHYCAACBngoAn/4BoIZnZ7ITAAAItDsAfPoHgFqemc27AsDwB4Ca9s5oXwEAQKCHA8CnfwCobc+sdgIAAIEEAAAEeigAHP8DQA+PzmwnAAAQ6NMA8OkfAHp5ZHY7AQCAQB8GgE//ANDTZzPcCQAABBIAABDo3QBw/A8AvX00y50AAECguwHg0z8ArOG9me4EAAACCQAACCQAACDQdwHg+38AWMu92e4EAAACCQAACPQqABz/A8Ca3s54JwAAEEgAAEAgAQAAgf4MAN//A8Dabme9EwAACCQAACCQAACAQAIAAAL9uG1+ARAAUrzMfCcAABBIAABAIAEAAIEEAAAEEgAAEEgAAECgH/wJYI7ff//37EsAGvj553/OvgQG+Gn2BXANwx541r39QxSsRwAsxNAHrnK7v4iBNQiABRj8wEgve44Q6E0ANGbwAzMJgd4EQEMGP1CJEOjJnwE2Y/gDVdmfehEAjXi5gOrsU334CqABLxTQia8EenACUJzhD3Rl/6pNABTm5QG6s4/VJQCK8tIAq7Cf1SQACvKyAKuxr9UjAIrxkgCrsr/VIgAAIJAAKEQdA6uzz9UhAIrwUgAp7Hc1CIACvAxAGvvefAIAAAIJgMlUMJDK/jeXAACAQAJgIvULpLMPziMAACCQAJhE9QJ8Yz+cQwAAQCABAACBBMAEjrsAXrMvjicAACCQAACAQAIAAAIJAAAIJAAG84suAPfZH8cSAAAQSAAAQCABAACBBAAABBIAABBIAABAIAEAAIEEAAAEEgAAEEgAAEAgAQAAgQQAAAQSAAAQSAAAQCABAACBBAAABBIAABBIAABAIAEAAIF+mn0B8Iz//uN/D/9n//6fv114JQA9CQDK2zPsH/3viwIgnQCgpKNDf8//vhgAEgkASrl68H/0zxQCQBIBQAkzBv971yAEgAQCgKkqDP63hACQwJ8BMk3F4X+r+vUBHCEAmKLLcO1ynQB7+QqAoToOVF8JACtyAsAwHYf/re7XD3BLADDEKsNzlfsAEABcbrWhudr9AJkEAJdadViuel9ADgHAZVYfkqvfH7A2AQAAgQQAl0j5dJxyn8B6BACnSxuKafcLrEEAcKrUYZh630BfAgAAAgkATpP+KTj9/oFeBAAABBIAnMKn32+sA9CFAACAQAKAw3zqfc16AB0IAAAIJAAAIJAA4BDH3fdZF6A6AQAAgQQAAAQSAAAQSAAAQCABwNP8otvHrA9QmQAAgEACAAACCQAACCQAACCQAACAQAIAAAIJAAAIJAAAIJAAAIBAAgAAAgkAnvb3//xt9iWUZn2AygQAAAQSAAAQSAAAQCABAACBBACH+EW3+6wLUJ0AAIBAAgAAAgkADnPc/Zr1ADoQAAAQSABwCp96v7EOQBcCAAACCQBOk/7pN/3+gV4EAAAEEgCcKvVTcOp9A30JAE6XNgzT7hdYgwDgEilDMeU+gfUIAAAIJAC4zOqfjle/P2BtAoBLrTokV70vIIcA4HKrDcvV7gfIJAAYYpWhucp9AAgAhuk+PLtfP8Ctn2ZfAFlehuh///G/yVfyOIMfWJETAKboMlS7XCfAXgKAaaoP1+rXB3CErwCYquJXAgY/kEAAUEKFEDD4gSQCgFJmhIDBDyQSAJR0O5SviAFDH0gnACjv3rDeEwWGPVX89tvX7Zdfvsy+DNi2TQDQlKFON7/99nX2JcAr/gwQYCAhQBUCAOBihj4VCQAACCQAAC5079O/EwEqEAAAFzHoqUwAAEAgAQBwgc8+/TsdYDYBAACBBADAyXy6pwMBAHCiPcNfKDCTAACAQAIA4CQ+0dOJAAA4wbPDXzQwiwAAgEACAOAgn+LpSAAATCYgmEEAABxgeNOVAAB4kuFPZwIAoAAxwWgCAOAJBjbdCQAACCQAAHa66tO/UwVGEgAAOxjSrEIAAEAgAQDwoBGf/p0wMIoAAIBAAgDgAT6ZsxoBAPCJ0cNfbDCCAICL2MSBygQAXOBl+IuA/jxDViUA4GRvB4YBwjP83HA1AQAnem/Ttpn35LmxMgEAgxgmvXherE4AwEkeGRiGCnv4eeFKAgBOsGejtqnX5xmRQADAQc8MCwMGmE0AwAFHBrkIqKnac6l2PaxDAMCTztiYbe61eB4kEQAwmaEDzCAA4AlnD20RMF/lZ1D52uhLAMBOV23GNvl5rD2JBADscPWgMIiAUQQAPGjUcBYBY3VZ7y7XSR8CAB7g/w8eWI0AgKJEwPWsMckEAHxi5pAwoK7TcW07XjN1CQD4QIUNt8I1AOsRAPCOSoO30rWswHqCAIC7Kg6IitfEeH4OOIsAgDcqb7CVr60LawjfCABoxgB7nrWDvwgAuNFlQHS5Tq7h+XMGAQD/r9um2u16Z7Ne8JoAgK3vcOh63cB8AoB43Ydo9+sfYcU1WvGeGEsAEG2VTXSV+7iCtYH7BAAswqAD9hAAxFpxYK54T0esvh6r3x/XEgBEWnnjXPnegPMIAOIkDMiEe/yMNYCPCQCiJA2FpHt9K+nek+6VcwkAYiRulIn3DDxGAMDi0iIg7X7hWQKACOlDIeX+U+7zrdT75hgBwPJsjgDfEwAszfD/y+prsfr9wdkEAMsyEL5nTdbl2bKXAGBJNsP3rbg2K94TXE0AQKCVBuZK9wIjCQCWYyA8xjqtxzNlDwHAUmyA+3Rfr+7XDzMJAJZhGDzHukEmAcASDLFjOq5fx2sewbrwKAFAeza8c3Rax07XClUJAFozCM5lPSGHAABeqR4B1a+vAmvEIwQAbdnkrmNtYX0CgJYMqOtVXOOK1wRdCQDaMQTGqbTWla6lA+vFZwQArdjUxrPmsCYBQBsG0Tyz1372Px9WJACAhxjC/XhmfEQA0IKNrIYZz8Gzh2sIAMozAGoZ+Tw8e7iOAKA0A6Amz6UPz4r3CADKsnHVdvXz8fzhWgKAkmz+PXhO0JcAAA65IgKExbmsJ/cIAMqxWfVz5jPz/GEMAUApNv++PDvoRQBQhgHS39Fn6GfgOtaWtwQAJdic1vHss/QzAGMJAKaz8a/HM4X6BABwiT0RIBjGsM7cEgBMZUNam+cLdQkApjEcMnz2nP0cwBwCgCls+lnee95+Dsaz5rwQAAxnA8rkuUMtAoChDIFst8/fzwLMJQCAoQz++TwDtk0AMJBNhxd+FmA+AcAQNnyAWgQAlzP8oR7vJQKAS9lkAGoSAFzG8AeoSwAAhBLp2QQAl7CxANQmADid4Q9QnwDgVIY/9OKdzSUAOI2NBKAPAcApDH+AXgQAhxn+0Jt3OJMAAIBAAoBDfHIA6EkA8DTDH9bhfc4jAHiKzQKgNwHAboY/QH8CgF0Mf1iX9zuLAACAQAKAh/l0ALAOAcBDDH/I4F3PIQD4lA0BYD0CgA8Z/gBrEgC8y/CHTN79DAIAAAIJAO7yCQBgbQKA7xj+gH1gfQKAV7z0ABkEAH8y/AFyCAC2bTP8ge/ZF9YmAAAgkABA5QMEEgDhDH/gI/aIdQmAYF5sgFwCIJThD5BNAAQy/IE97BlrEgAAEEgAhFHyAGybAIhi+APPsn+sRwCE8PICcEsABDD8AXhLACzO8AfOYj9ZiwAAgEACYGFqHYD3CIBFGf7AFewt6xAAC/KCAvAZAbAYwx+ARwiAhRj+wAj2mjUIAAAIJAAWocgB2EMALMDwB0az7/QnAJrzEgLwjJ9mXwDH/PLLl9mXAEBDTgAAIJAAAIBAAgAAAgkAAAgkAAAgkAAAgEACAAACCQAACCQAACCQAACAQAIAAAIJAAAIJAAAIJAAAIBAAgAAAgkAAAgkAAAgkAAAgEACAAACCQAACCQABvv553/OvgSAkuyPYwkAAAgkAAAgkAAAgEACAAACCYAJ/KILwGv2xfEEAAAEEgAAEEgATOK4C+Ab++EcAgAAAgmAiVQvkM4+OI8AAIBAAmAy9Quksv/NJQAAIJAAKEAFA2nse/MJgCK8DEAK+10NAqAQLwWwOvtcHQIAAAIJgGLUMbAq+1stAqAgLwmwGvtaPQKgKC8LsAr7WU0CoDAvDdCdfawuAVCclwfoyv5V20+zL4DPvbxEv//+78lXAvA5g78HJwCNeKmA6uxTfQiAZrxcQFX2p158BdCQrwSASgz+ngRAY0IAmMng700ALEAIACMZ/GsQAAu5fSnFAHAmQ389P2zbtn358usfsy+E64kC4BGG/fq+fv3XD04AgnipAXjhzwABIJAAAIBAAgAAAgkAAAgkAAAg0I/b9u3PAWZfCABwvZeZ7wQAAAIJAAAIJAAAIJAAAIBAfwaAXwQEgLXdznonAAAQSAAAQCABAACBXgWA3wMAgDW9nfFOAAAgkAAAgEDfBYCvAQBgLfdmuxMAAAgkAAAgkAAAgEB3A8DvAQDAGt6b6U4AACDQuwHgFAAAevtoljsBAIBAAgAAAn0YAL4GAICePpvhTgAAINCnAeAUAAB6eWR2OwEAgEAPBYBTAADo4dGZ7QQAAAIJAAAI9HAA+BoAAGrbM6udAABAoF0B4BQAAGraO6N3nwCIAACo5ZnZ7CsAAAj0VAA4BQCAGp6dyU4AACDQ0wHgFAAA5joyi50AAECgQwHgFAAA5jg6gw+fAIgAABjrjNnrKwAACHRKADgFAIAxzpq5p50AiAAAuNaZs/bUrwBEAABc4+wZ63cAACDQ6QHgFAAAznXFbL3kBEAEAMA5rpqpl30FIAIA4JgrZ6nfAQCAQJcGgFMAAHjO1TP08hMAEQAA+4yYnUO+AhABAPCYUTNz2O8AiAAA+NjIWTn0lwBFAADcN3pGDv8rABEAAK/NmI1T/gxQBADAN7Nm4rR/D4AIACDdzFk49V8EJAIASDV7Bk7/NwHOXgAAGK3C7JseANtWYyEAYIQqM69EAGxbnQUBgKtUmnVlAmDbai0MAJyp2owrFQDbVm+BAOCoirOt3AXd+vLl1z9mXwMAPKvi4H9R7gTgVuWFA4CPVJ9hpQNg2+ovIAC81WF2lb/AW74SAKCyDoP/RfkTgFudFhaALN1mVKsA2LZ+CwzA+jrOpnYXfMtXAgDM1HHwv2h3AnCr88ID0Fv3GdT64m85DQBghO6D/8USN3FLCABwhVUG/4ulbuaWEADgDKsN/hetfwfgI6s+MADGWXmWLHtjt5wGALDHyoP/xfI3+JYYAOCehKF/K+pmbwkBALYtb/C/iLzpW0IAIFPq4H8RffNviQGAtaUP/VsW4g4hALAWg/97FuQBggCgFwP/cxZoJzEAUJOhv4/FOkgQAMxh4B9j8S4gCgDOZdifz4IOJg4A7jPkx/o/rsTlUKe3I3IAAAAASUVORK5CYII="


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


def centered_foreground_layer(image, canvas_size):
    """Build an Android adaptive icon foreground layer.

    The layer canvas is the full 108dp square. Content should be sized so its
    important detail sits inside the 66dp "safe zone" (guaranteed visible
    under every mask shape), while the artwork itself typically fills closer
    to the 72dp legacy-icon area so it doesn't look tiny once masked. We size
    to 72/108 here to match what tools like Android Studio's Image Asset
    Studio use as a default, rather than shrinking everything down to the
    66dp safe-zone diameter (which under-fills the icon and looks padded).
    """
    content_size = round(canvas_size * (72 / 108))
    resized = image.resize((content_size, content_size), Image.LANCZOS)
    canvas = Image.new("RGBA", (canvas_size, canvas_size), (0, 0, 0, 0))
    offset = ((canvas_size - content_size) // 2, (canvas_size - content_size) // 2)
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
        centered_foreground_layer(foreground_image, adaptive_layer_size).save(mipmap_dir / "ic_launcher_foreground.png")

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
    for points, scale, idiom in IOS_ICONS:
        size_px = int(round(points * scale))
        points_label = f"{int(points)}" if float(points).is_integer() else f"{points}"
        # Include idiom in the filename: the same (points, scale) pair can
        # appear for both iphone and ipad (e.g. 20pt@2x), so the size alone
        # isn't a unique filename and would silently overwrite the other.
        filename = f"icon_{idiom}_{points_label}x{points_label}@{scale}x.png"

        flatten_to_white(square_fit(ios_image, size_px)).save(appiconset / filename)
        images.append(
            {
                "size": f"{points_label}x{points_label}",
                "idiom": idiom,
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