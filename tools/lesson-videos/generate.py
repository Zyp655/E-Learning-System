"""
Generates narrated lecture videos for the video lessons of the programming courses (lms-web mock data).

Per segment: the narration in narration.json is spoken sentence by sentence with the macOS Vietnamese voice
"Linh" (offline TTS), and a 1280x720 slide is rendered with the segment title, the slide code (syntax
highlighted, typed in as the lecturer talks) and the key points. Segment boundaries in the video follow the
real audio length, so the in-video quizzes fire at the end of what was actually said.

Outputs:
  lms-web/public/videos/lessons/<lessonId>.mp4   H.264 + AAC
  lms-web/public/videos/lessons/<lessonId>.vtt   captions, one cue per spoken sentence
  lms-web/src/api/generatedLessonVideos.json     video URL, duration, segment timestamps and timed transcript

Requires macOS `say` (voice Linh), ffmpeg / ffprobe and Pillow. Run from the repo root:
  ml/.venv/bin/python tools/lesson-videos/generate.py [--lessons 501 604] [--voice Linh] [--rate 180]
"""

from __future__ import annotations

import argparse
import json
import math
import re
import shutil
import subprocess
import tempfile
import wave
from dataclasses import dataclass
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[2]
TOOL_DIR = Path(__file__).resolve().parent
WEB = ROOT / "lms-web"
VIDEO_DIR = WEB / "public" / "videos" / "lessons"
MANIFEST = WEB / "src" / "api" / "generatedLessonVideos.json"

W, H = 1280, 720
FPS = 12
SAMPLE_RATE = 24000
LEAD_SILENCE = 0.6       # before the first sentence of a segment (title card is on screen)
SENTENCE_GAP = 0.35
TAIL_SILENCE = 1.0       # after the last sentence, then padded up to a whole second
TITLE_CARD_SEC = 2.4
TYPING_SHARE = 0.45      # code finishes typing at this share of the segment

FONT_SANS = "/System/Library/Fonts/Supplemental/Arial.ttf"
FONT_SANS_BOLD = "/System/Library/Fonts/Supplemental/Arial Bold.ttf"
# SF Mono: Menlo lacks several Vietnamese precomposed letters (ả, ổ, ...), which appear in code comments.
FONT_MONO = "/System/Library/Fonts/SFNSMono.ttf"

COLORS = {
    "bg": (15, 23, 42),
    "panel": (2, 6, 23),
    "panel_border": (30, 41, 59),
    "accent": (8, 102, 255),
    "brand": (218, 31, 39),
    "text": (248, 250, 252),
    "muted": (148, 163, 184),
    "line_no": (71, 85, 105),
    "code": (226, 232, 240),
    "keyword": (192, 132, 252),
    "string": (134, 239, 172),
    "number": (251, 191, 36),
    "comment": (100, 116, 139),
    "builtin": (56, 189, 248),
}

KEYWORDS = {
    "python": {"def", "return", "if", "elif", "else", "for", "while", "in", "and", "or", "not", "True", "False",
               "None", "import", "from", "as", "break", "continue", "pass", "class", "lambda", "is"},
    "javascript": {"const", "let", "var", "function", "return", "if", "else", "for", "while", "of", "in", "true",
                   "false", "null", "undefined", "new", "async", "await", "typeof", "class", "import", "export"},
}
BUILTINS = {
    "python": {"print", "type", "int", "float", "str", "len", "range", "input", "enumerate", "list", "dict", "set"},
    "javascript": {"console", "document", "Math", "Object", "Promise", "fetch"},
}
TOKEN_RE = re.compile(
    r"(?P<comment>#[^\n]*|//[^\n]*)"
    r"|(?P<string>f?\"[^\"\n]*\"|f?'[^'\n]*'|`[^`\n]*`)"
    r"|(?P<number>\b\d+(?:\.\d+)?\b)"
    r"|(?P<word>[A-Za-z_][A-Za-z0-9_]*)"
    r"|(?P<other>.)",
    re.S,
)


def font(path: str, size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(path, size)


F_SMALL = font(FONT_SANS, 20)
F_BODY = font(FONT_SANS, 22)
F_TITLE = font(FONT_SANS_BOLD, 34)
F_CARD_KICKER = font(FONT_SANS_BOLD, 26)
F_CARD_TITLE = font(FONT_SANS_BOLD, 46)
F_CODE_SIZES = [font(FONT_MONO, size) for size in (26, 23, 20)]
F_KEY = font(FONT_MONO, 18)


# --------------------------------------------------------------------------------------------------- audio


def run(cmd: list[str]) -> str:
    return subprocess.run(cmd, check=True, capture_output=True, text=True).stdout


def split_sentences(text: str) -> list[str]:
    parts = re.split(r"(?<=[.!?:])\s+(?=[A-ZĐÀ-Ỹa-zđ])", text.strip())
    return [p.strip() for p in parts if p.strip()]


def tts_sentence(text: str, out_wav: Path, voice: str, rate: int, tmp: Path) -> None:
    aiff = tmp / (out_wav.stem + ".aiff")
    subprocess.run(["say", "-v", voice, "-r", str(rate), "-o", str(aiff), text], check=True)
    run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(aiff), "-ac", "1", "-ar", str(SAMPLE_RATE),
         "-sample_fmt", "s16", str(out_wav)])


def read_pcm(path: Path) -> bytes:
    with wave.open(str(path), "rb") as w:
        return w.readframes(w.getnframes())


def silence(seconds: float) -> bytes:
    return b"\x00\x00" * int(round(seconds * SAMPLE_RATE))


@dataclass
class Cue:
    start: float
    end: float
    text: str


@dataclass
class SegmentTiming:
    index: int
    start: int
    end: int
    cues: list[Cue]


def build_audio(lesson_id: int, narration: dict[str, str], voice: str, rate: int, tmp: Path) -> tuple[bytes, list[SegmentTiming]]:
    """Speaks every segment and returns the lesson PCM plus integer-second segment boundaries and caption cues."""
    pcm = bytearray()
    timings: list[SegmentTiming] = []
    t = 0.0
    for seg_key in sorted(narration, key=int):
        seg_start = t
        pcm += silence(LEAD_SILENCE)
        t += LEAD_SILENCE
        cues: list[Cue] = []
        for k, sentence in enumerate(split_sentences(narration[seg_key])):
            wav = tmp / f"{lesson_id}_{seg_key}_{k:02d}.wav"
            tts_sentence(sentence, wav, voice, rate, tmp)
            data = read_pcm(wav)
            dur = len(data) / 2 / SAMPLE_RATE
            cues.append(Cue(t, t + dur, sentence))
            pcm += data + silence(SENTENCE_GAP)
            t += dur + SENTENCE_GAP
        # Pad the segment to a whole number of seconds: segment timestamps in the LMS are integers.
        seg_end = math.ceil(t + TAIL_SILENCE)
        pcm += silence(seg_end - t)
        t = float(seg_end)
        timings.append(SegmentTiming(int(seg_key), int(round(seg_start)), seg_end, cues))
    return bytes(pcm), timings


# --------------------------------------------------------------------------------------------------- slides


def wrap(draw: ImageDraw.ImageDraw, text: str, fnt: ImageFont.FreeTypeFont, width: int) -> list[str]:
    lines: list[str] = []
    for paragraph in text.split("\n"):
        line = ""
        for word in paragraph.split(" "):
            candidate = f"{line} {word}".strip()
            if draw.textlength(candidate, font=fnt) <= width or not line:
                line = candidate
            else:
                lines.append(line)
                line = word
        lines.append(line)
    return lines


def tokenize(code: str, language: str) -> list[tuple[str, tuple[int, int, int]]]:
    out = []
    for m in TOKEN_RE.finditer(code):
        kind = m.lastgroup
        tok = m.group()
        if kind == "comment":
            color = COLORS["comment"]
        elif kind == "string":
            color = COLORS["string"]
        elif kind == "number":
            color = COLORS["number"]
        elif kind == "word" and tok in KEYWORDS[language]:
            color = COLORS["keyword"]
        elif kind == "word" and tok in BUILTINS[language]:
            color = COLORS["builtin"]
        else:
            color = COLORS["code"]
        out.append((tok, color))
    return out


def draw_code(draw: ImageDraw.ImageDraw, code: str, language: str, visible_chars: int, box: tuple[int, int, int, int], caret: bool) -> None:
    x0, y0, x1, y1 = box
    draw.rounded_rectangle(box, radius=14, fill=COLORS["panel"], outline=COLORS["panel_border"], width=2)
    for i, c in enumerate([(239, 68, 68), (245, 158, 11), (34, 197, 94)]):
        draw.ellipse((x0 + 20 + i * 22, y0 + 16, x0 + 32 + i * 22, y0 + 28), fill=c)
    draw.text((x0 + 96, y0 + 12), "main.py" if language == "python" else "main.js", font=F_SMALL, fill=COLORS["muted"])

    # Largest font size whose longest line fits the panel.
    gutter = x0 + 62
    longest = max(code.split("\n"), key=len)
    f_code = next((f for f in F_CODE_SIZES if gutter + draw.textlength(longest, font=f) <= x1 - 20), F_CODE_SIZES[-1])
    line_h = int(f_code.size * 1.55)
    top = y0 + 60
    n_lines = code.count("\n") + 1
    for i in range(n_lines):
        draw.text((x0 + 18, top + i * line_h), f"{i + 1:>2}", font=f_code, fill=COLORS["line_no"])

    shown = 0
    x, y = gutter, top
    for tok, color in tokenize(code, language):
        if shown >= visible_chars:
            break
        part = tok[: max(0, visible_chars - shown)]
        shown += len(part)
        for j, piece in enumerate(part.split("\n")):
            if j > 0:
                x, y = gutter, y + line_h
            if piece:
                draw.text((x, y), piece, font=f_code, fill=color)
                x += draw.textlength(piece, font=f_code)
    if caret:
        draw.rectangle((x + 2, y + 3, x + 2 + f_code.size // 2, y + f_code.size + 4), fill=COLORS["accent"])


def render_base(lesson: dict, seg: dict, seg_no: int, n_segs: int) -> Image.Image:
    img = Image.new("RGB", (W, H), COLORS["bg"])
    d = ImageDraw.Draw(img)
    d.rectangle((0, 0, W, 6), fill=COLORS["accent"])
    d.text((48, 26), f"{lesson['courseTitle']}  ·  {lesson['title']}", font=F_SMALL, fill=COLORS["muted"])
    d.text((48, 62), f"Phần {seg_no}/{n_segs}: {seg['title']}", font=F_TITLE, fill=COLORS["text"])

    # Right column: key points + summary
    x0, y0, x1 = 840, 130, W - 48
    d.rounded_rectangle((x0, y0, x1, 600), radius=14, fill=(30, 41, 59))
    d.text((x0 + 22, y0 + 18), "GHI NHỚ", font=F_CARD_KICKER, fill=COLORS["builtin"])
    y = y0 + 64
    for item in seg["keyFormulas"]:
        for line in wrap(d, item, F_KEY, x1 - x0 - 44):
            d.text((x0 + 22, y), line, font=F_KEY, fill=COLORS["text"])
            y += 26
        y += 12
    y += 8
    d.line((x0 + 22, y, x1 - 22, y), fill=COLORS["panel_border"], width=2)
    y += 18
    for line in wrap(d, seg["summary"], F_BODY, x1 - x0 - 44):
        d.text((x0 + 22, y), line, font=F_BODY, fill=COLORS["muted"])
        y += 30
    return img


def render_title_card(lesson: dict, seg: dict, seg_no: int) -> Image.Image:
    img = Image.new("RGB", (W, H), COLORS["bg"])
    d = ImageDraw.Draw(img)
    d.rectangle((0, 0, W, 6), fill=COLORS["accent"])
    lines = wrap(d, seg["title"], F_CARD_TITLE, W - 240)
    block_h = 50 + len(lines) * 60
    y = (H - block_h) // 2 - 20
    if seg_no == 1:
        sub = f"{lesson['courseTitle']}  ·  {lesson['instructor']}"
        d.text(((W - d.textlength(sub, font=F_BODY)) / 2, y - 70), sub, font=F_BODY, fill=COLORS["muted"])
        head = lesson["title"]
        for hl in wrap(d, head, F_CARD_KICKER, W - 240):
            d.text(((W - d.textlength(hl, font=F_CARD_KICKER)) / 2, y - 30), hl, font=F_CARD_KICKER, fill=COLORS["text"])
            y += 36
        y += 20
    kicker = f"PHẦN {seg_no}"
    d.text(((W - d.textlength(kicker, font=F_CARD_KICKER)) / 2, y), kicker, font=F_CARD_KICKER, fill=COLORS["brand"])
    y += 50
    for line in lines:
        d.text(((W - d.textlength(line, font=F_CARD_TITLE)) / 2, y), line, font=F_CARD_TITLE, fill=COLORS["text"])
        y += 60
    return img


def render_lesson_frames(lesson: dict, timings: list[SegmentTiming], total_sec: float):
    """Yields raw RGB frames for the whole lesson."""
    segs = {s["segmentIndex"]: s for s in lesson["segments"]}
    n_frames = int(round(total_sec * FPS))
    cache: dict[int, tuple[Image.Image, Image.Image]] = {}
    for f in range(n_frames):
        t = f / FPS
        timing = next((s for s in timings if s.start <= t < s.end), timings[-1])
        seg = segs[timing.index]
        if timing.index not in cache:
            cache[timing.index] = (render_base(lesson, seg, timing.index, len(timings)), render_title_card(lesson, seg, timing.index))
        base, card = cache[timing.index]
        local = t - timing.start
        seg_len = timing.end - timing.start

        frame = base.copy()
        d = ImageDraw.Draw(frame)
        code = seg["codeSnippet"]
        typing_start = TITLE_CARD_SEC
        typing_end = max(typing_start + 1.0, seg_len * TYPING_SHARE)
        progress = min(max((local - typing_start) / (typing_end - typing_start), 0.0), 1.0)
        visible = int(round(progress * len(code)))
        caret = progress < 1.0 or int(t * 2) % 2 == 0
        draw_code(d, code, lesson["language"], visible, (48, 130, 808, 600), caret)

        # Spoken sentence as a lower third, plus the segment progress bar.
        cue = next((c for c in timing.cues if c.start <= t < c.end + SENTENCE_GAP), None)
        if cue:
            lines = wrap(d, cue.text, F_BODY, W - 160)[-2:]
            d.rounded_rectangle((48, 616, W - 48, 616 + 18 + 30 * len(lines)), radius=10, fill=(0, 0, 0))
            for i, line in enumerate(lines):
                d.text((68, 624 + 30 * i), line, font=F_BODY, fill=COLORS["text"])
        d.rectangle((0, H - 6, W, H), fill=COLORS["panel_border"])
        d.rectangle((0, H - 6, int(W * local / seg_len), H), fill=COLORS["brand"])

        if local < TITLE_CARD_SEC:
            fade = min(max((TITLE_CARD_SEC - local) / 0.5, 0.0), 1.0)
            frame = Image.blend(frame, card, fade)
        yield frame.tobytes()


# --------------------------------------------------------------------------------------------------- output


def fmt_vtt(t: float) -> str:
    ms = int(round(t * 1000))
    return f"{ms // 3_600_000:02d}:{ms // 60_000 % 60:02d}:{ms // 1000 % 60:02d}.{ms % 1000:03d}"


def fmt_mmss(t: float) -> str:
    s = int(t)
    return f"{s // 60:02d}:{s % 60:02d}"


def generate_lesson(lesson: dict, narration: dict[str, str], voice: str, rate: int) -> dict:
    VIDEO_DIR.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp_name:
        tmp = Path(tmp_name)
        pcm, timings = build_audio(lesson["id"], narration, voice, rate, tmp)
        audio = tmp / "lesson.wav"
        with wave.open(str(audio), "wb") as w:
            w.setnchannels(1)
            w.setsampwidth(2)
            w.setframerate(SAMPLE_RATE)
            w.writeframes(pcm)
        total = float(timings[-1].end)

        out = VIDEO_DIR / f"{lesson['id']}.mp4"
        ff = subprocess.Popen(
            ["ffmpeg", "-y", "-loglevel", "error",
             "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
             "-i", str(audio),
             "-c:v", "libx264", "-preset", "medium", "-tune", "stillimage", "-crf", "24", "-pix_fmt", "yuv420p",
             "-c:a", "aac", "-b:a", "96k", "-shortest", "-movflags", "+faststart", str(out)],
            stdin=subprocess.PIPE,
        )
        assert ff.stdin is not None
        for frame in render_lesson_frames(lesson, timings, total):
            ff.stdin.write(frame)
        ff.stdin.close()
        if ff.wait() != 0:
            raise RuntimeError(f"ffmpeg failed for lesson {lesson['id']}")

    vtt = ["WEBVTT", ""]
    for timing in timings:
        for c in timing.cues:
            vtt += [f"{fmt_vtt(c.start)} --> {fmt_vtt(c.end)}", c.text, ""]
    (VIDEO_DIR / f"{lesson['id']}.vtt").write_text("\n".join(vtt), encoding="utf-8")

    return {
        "videoUrl": f"/videos/lessons/{lesson['id']}.mp4",
        "captionsUrl": f"/videos/lessons/{lesson['id']}.vtt",
        "durationSeconds": int(total),
        "voice": voice,
        "segments": [
            {
                "segmentIndex": t.index,
                "startTimestamp": t.start,
                "endTimestamp": t.end,
                "transcript": " ".join(f"[{fmt_mmss(c.start)}] {c.text}" for c in t.cues),
            }
            for t in timings
        ],
    }


def export_lessons() -> list[dict]:
    out = run(["node", "--experimental-strip-types", "--no-warnings", str(TOOL_DIR / "export-lessons.mjs")])
    return json.loads(out)


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--lessons", type=int, nargs="*", help="lesson ids (default: every lesson in narration.json)")
    ap.add_argument("--voice", default="Linh")
    ap.add_argument("--rate", type=int, default=180, help="words per minute for `say`")
    args = ap.parse_args()

    for tool in ("say", "ffmpeg", "ffprobe", "node"):
        if shutil.which(tool) is None:
            raise SystemExit(f"missing required tool: {tool}")

    narration = json.loads((TOOL_DIR / "narration.json").read_text(encoding="utf-8"))
    lessons = {l["id"]: l for l in export_lessons()}
    ids = args.lessons or [int(k) for k in narration]
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8")) if MANIFEST.exists() else {}

    for lesson_id in ids:
        lesson = lessons[lesson_id]
        seg_narration = narration[str(lesson_id)]
        if sorted(int(k) for k in seg_narration) != [s["segmentIndex"] for s in lesson["segments"]]:
            raise SystemExit(f"narration segments of lesson {lesson_id} do not match the lesson's segments")
        print(f"lesson {lesson_id}: {lesson['title']}", flush=True)
        manifest[str(lesson_id)] = generate_lesson(lesson, seg_narration, args.voice, args.rate)
        print(f"  -> {manifest[str(lesson_id)]['durationSeconds']} s", flush=True)

    MANIFEST.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"wrote {MANIFEST.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
