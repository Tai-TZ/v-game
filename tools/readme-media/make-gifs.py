# /// script
# requires-python = ">=3.10"
# dependencies = ["pillow"]
# ///
"""Assemble the README media from out/ (written by capture-media.mjs) into <repo>/docs/media/.

    uvx --with pillow python tools/readme-media/make-gifs.py            # every out/frames/<name>/
    uvx --with pillow python tools/readme-media/make-gifs.py hero-walk  # just one
    uvx --with pillow python tools/readme-media/make-gifs.py --check    # self-check, no frames needed

Each GIF: resized to 960 px wide, at most ~12 fps (hero-walk is captured at 10 fps), identical
frames merged, one shared palette without dithering (the scene is flat-shaded), retried with fewer
colours until it is at most 4 MB (4,000,000 bytes). The width never shrinks: exits 1 if a GIF
still does not fit (shorten the capture). The PNGs in out/png/ are re-saved optimised.
"""

from __future__ import annotations

import io
import json
import sys
from pathlib import Path

from PIL import Image, ImageChops

HERE = Path(__file__).resolve().parent  # <repo>/tools/readme-media
FRAMES, PNGS, OUT = (
    HERE / "out" / "frames",
    HERE / "out" / "png",
    HERE.parents[1] / "docs" / "media",
)
MAX_BYTES = 4_000_000
WIDTH = 960
MIN_FRAME_MS = 1000 / 12 * 0.9  # keep at most ~12 frames per second
# Frames cross-faded from the last frame back to the first, for GIFs that do not loop seamlessly.
# Not hero-walk: its follow camera pans, so each faded frame costs ~0.1 MB it does not have.
LOOP_FADE = {"back-campus": 4}
FADE_MS = 80
# Palette sizes tried in order until the file fits MAX_BYTES.
ATTEMPTS = (256, 192, 128, 96, 64)


def timings(stamps: list[float], frame_ms: float) -> list[tuple[int, int]]:
    """(frame index, duration in ms) for the frames kept at <= ~12 fps; durations follow the stamps."""
    kept = [0]
    for i in range(1, len(stamps)):
        if stamps[i] - stamps[kept[-1]] >= MIN_FRAME_MS:
            kept.append(i)
    ends = [stamps[k] for k in kept[1:]] + [stamps[-1] + frame_ms]
    return [(k, round(end - stamps[k])) for k, end in zip(kept, ends, strict=True)]


def to_width(frame: Image.Image) -> Image.Image:
    """Scales to WIDTH px wide (before blending and merging, so merged frames compare equal)."""
    if frame.width == WIDTH:
        return frame
    return frame.resize(
        (WIDTH, round(frame.height * WIDTH / frame.width)), Image.Resampling.LANCZOS
    )


def merge_identical(frames: list[Image.Image], durations: list[int]) -> tuple[list, list[int]]:
    out, out_ms = [frames[0]], [durations[0]]
    for frame, ms in zip(frames[1:], durations[1:], strict=True):
        if ImageChops.difference(out[-1], frame).getbbox() is None:
            out_ms[-1] += ms
        else:
            out.append(frame)
            out_ms.append(ms)
    return out, out_ms


def shared_palette(frames: list[Image.Image], colours: int) -> Image.Image:
    """Median-cut palette from up to 16 evenly spaced frames (nearest-neighbour thumbnails keep real colours)."""
    sample = frames[:: max(1, len(frames) // 16)][:16]
    w, h = max(1, frames[0].width // 2), max(1, frames[0].height // 2)
    mosaic = Image.new("RGB", (w, h * len(sample)))
    for i, frame in enumerate(sample):
        mosaic.paste(frame.resize((w, h), Image.Resampling.NEAREST), (0, h * i))
    return mosaic.quantize(colors=colours, method=Image.Quantize.MEDIANCUT)


def encode_gif(frames: list[Image.Image], durations: list[int], colours: int) -> bytes:
    palette = shared_palette(frames, colours)
    indexed = [frame.quantize(palette=palette, dither=Image.Dither.NONE) for frame in frames]
    buffer = io.BytesIO()
    # Pillow stores each frame as the rectangle that changed since the previous one.
    indexed[0].save(
        buffer,
        format="GIF",
        save_all=True,
        append_images=indexed[1:],
        duration=durations,
        loop=0,
        disposal=1,
    )
    return buffer.getvalue()


def build(name: str) -> bool:
    """Writes OUT/<name>.gif; returns whether it fits MAX_BYTES."""
    folder = FRAMES / name
    timeline = json.loads((folder / "timeline.json").read_text("utf-8"))
    stamps = [float(frame["t"]) for frame in timeline["frames"]]
    picked = timings(stamps, float(timeline["frame_ms"]))
    frames = [
        to_width(Image.open(folder / timeline["frames"][i]["file"]).convert("RGB"))
        for i, _ in picked
    ]
    durations = [ms for _, ms in picked]

    fade, last = LOOP_FADE.get(name, 0), frames[-1]
    for step in range(1, fade + 1):
        frames.append(Image.blend(last, frames[0], step / (fade + 1)))
        durations.append(FADE_MS)

    frames, durations = merge_identical(frames, durations)
    # Sized in memory and written once: rewriting a file Windows is still scanning fails (Errno 22).
    for colours in ATTEMPTS:
        data = encode_gif(frames, durations, colours)
        seconds = sum(durations) / 1000
        print(
            f"  {name}: {len(frames)} frames, {seconds:.1f} s, {colours} colours -> {len(data) / 1e6:.2f} MB"
        )
        if len(data) <= MAX_BYTES:
            (OUT / f"{name}.gif").write_bytes(data)
            return True
    print(
        f"  {name}: still over {MAX_BYTES / 1e6:.1f} MB with {ATTEMPTS[-1]} colours; shorten the capture"
    )
    return False


def copy_pngs() -> None:
    for source in sorted(PNGS.glob("*.png")):
        target = OUT / source.name
        Image.open(source).save(target, optimize=True)
        print(
            f"  {source.name}: {source.stat().st_size / 1e6:.2f} MB -> {target.stat().st_size / 1e6:.2f} MB"
        )


def check() -> None:
    # 80 ms virtual frames are all kept; their durations are the gaps.
    assert timings([0, 80, 160], 80) == [(0, 80), (1, 80), (2, 80)]
    # Real-time frames closer than ~75 ms are dropped and their time goes to the kept frame.
    assert timings([0, 40, 90, 120, 200], 80) == [(0, 90), (2, 110), (4, 80)]
    red, blue = Image.new("RGB", (4, 4), "red"), Image.new("RGB", (4, 4), "blue")
    frames, ms = merge_identical([red, red.copy(), blue, blue.copy(), red], [80, 80, 80, 80, 80])
    assert ms == [160, 160, 80] and len(frames) == 3
    assert to_width(Image.new("RGB", (1280, 800))).size == (960, 600)
    print("make-gifs: self-check passed")


def main(argv: list[str]) -> None:
    if argv == ["--check"]:
        check()
        return
    OUT.mkdir(parents=True, exist_ok=True)
    names = argv or sorted(p.parent.name for p in FRAMES.glob("*/timeline.json"))
    if not names and not any(PNGS.glob("*.png")):
        sys.exit("Nothing to do: run capture-media.mjs first.")
    too_big = [name for name in names if not build(name)]
    if not argv:
        copy_pngs()
    if too_big:
        sys.exit(f"Over {MAX_BYTES / 1e6:.1f} MB: {', '.join(too_big)}")


if __name__ == "__main__":
    main(sys.argv[1:])
