"""Generate app icon, adaptive-icon, and splash from source.jpg."""
from pathlib import Path
from PIL import Image, ImageOps

HERE = Path(__file__).parent
SRC = HERE / "source.jpg"
BRAND = (31, 122, 77)  # #1f7a4d


def sample_bg(img: Image.Image) -> tuple:
    """Average the four corner pixels to infer the source's background color."""
    img = img.convert("RGB")
    w, h = img.size
    pts = [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)]
    rs, gs, bs = zip(*(img.getpixel(p) for p in pts))
    return (sum(rs) // 4, sum(gs) // 4, sum(bs) // 4)


def square_fit(img: Image.Image, size: int, bg=None) -> Image.Image:
    """Scale img to fit inside size x size, center on bg (or sampled corner)."""
    img = ImageOps.exif_transpose(img).convert("RGBA")
    if bg is None:
        bg = sample_bg(img)
    img.thumbnail((size, size), Image.LANCZOS)
    canvas = Image.new("RGBA", (size, size), (*bg, 255))
    canvas.paste(img, ((size - img.width) // 2, (size - img.height) // 2), img)
    return canvas


def adaptive_fit(img: Image.Image, size: int) -> Image.Image:
    """Adaptive icon foreground: keep brand inside center 66% safe area, transparent bg."""
    img = ImageOps.exif_transpose(img).convert("RGBA")
    inner = int(size * 0.66)
    img.thumbnail((inner, inner), Image.LANCZOS)
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    canvas.paste(img, ((size - img.width) // 2, (size - img.height) // 2), img)
    return canvas


def splash(img: Image.Image, w: int, h: int) -> Image.Image:
    """Center logo on brand-color splash."""
    img = ImageOps.exif_transpose(img).convert("RGBA")
    target = int(min(w, h) * 0.55)
    img.thumbnail((target, target), Image.LANCZOS)
    canvas = Image.new("RGBA", (w, h), (*BRAND, 255))
    canvas.paste(img, ((w - img.width) // 2, (h - img.height) // 2), img)
    return canvas


def main():
    src = Image.open(SRC)
    bg = sample_bg(src)
    print(f"Sampled source background: rgb{bg}")
    square_fit(src.copy(), 1024, bg=bg).save(HERE / "icon.png", optimize=True)
    adaptive_fit(src.copy(), 1024).save(HERE / "adaptive-icon.png", optimize=True)
    splash(src.copy(), 1284, 2778).save(HERE / "splash.png", optimize=True)
    square_fit(src.copy(), 512, bg=bg).save(HERE / "favicon.png", optimize=True)
    print("Generated icon.png, adaptive-icon.png, splash.png, favicon.png")


if __name__ == "__main__":
    main()
