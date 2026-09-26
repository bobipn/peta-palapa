# @sasira_aim — 15s resume reel (1080×1920, 30fps, H.264 + AAC)

Fully procedural motion graphics (canvas) plus a synthesized 120 BPM track. Every cut lands on a beat.

| Time | Beat | Technique / camera | Palette |
|---|---|---|---|
| 0.0–1.2 | HOOK: "STOP SCROLLING. Your food deserves a better ad." | Crash zoom, strobe, radial speed lines | Red / yellow |
| 1.2–3.4 | THE DROP | Knife-slash wipe, yolk squash & stretch, splash, push-in + roll | Black / amber |
| 3.4–5.6 | SIZZLE SELLS | Whip-pan with motion blur, flames, ingredient toss, beat shake | Teal / orange |
| 5.6–7.8 | 360° ORBIT | Iris-in, top-down spin, dutch tilt | Magenta / yellow |
| 7.8–10.0 | PRODUCT IS THE HERO | RGB glitch cut, spotlight, dolly-in, light sweep, sauce crown | Black / gold |
| 10.0–12.0 | STRATEGY · SHOOT · STYLE · SCALE | 3×3 grid, colour shifts on every half beat | Full spectrum |
| 12.0–13.4 | Taste you can SEE. | Drums drop out, slow-mo steam, editorial serif | Cream / ink / red |
| 13.4–15.0 | Final frame: fork × knife monogram, @sasira_aim, "COOKING ADS THAT GET DEVOURED.", CTA | Boom, elastic reveal, shine sweep | Black / yellow |

Rebuild: `node render.js` (Playwright) → `python3 audio.py` → ffmpeg
`-framerate 30 -i frames/f%04d.png -i track.wav -c:v libx264 -crf 18 -pix_fmt yuv420p -c:a aac`.
Fonts: Anton, Playfair Display, Space Mono (SIL OFL 1.1, licenses in `OFL-*.txt`).
