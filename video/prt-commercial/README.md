# Palapa Ring Tengah: Product & Commercial Profile

The content comes from `Produk_Dan_Layanan_Paring_Tengah_2025__kolokasi.pptx`. It is recreated as motion graphics, not screen-recorded.

| File | Duration | Notes |
|---|---|---|
| `PRT_Product_Commercial_Profile_MAIN.mp4` | 5:59.8 | 1080p30, 13 acts |
| `PRT_Commercial_Teaser_90s.mp4` | 1:25.4 | Commercial teaser |
| `PRT_Sales_Campaign.mp4` | 0:33.9 | Sales campaign |
| `PRODUCTION_BIBLE.md` | — | All 19 required sections, including the fact-check table and the [NEEDS CONFIRMATION] items |
| `subtitles/*.srt` | — | Indonesian subtitles, timed to the voice-over |

**Status: draft for review.** The voice-over is a synthetic guide voice (Piper TTS, `id_ID-news_tts-medium`). Re-record it with a professional narrator using section 5 of the bible.

## How it is built

- **Figures:** `source/facts.js` is the single source of truth, transcribed from the PPT. `source/script.js` holds the VO and scene list for all three cuts.
- **Graphics:** `source/engine.js` is a Canvas 2D engine that draws levels 2 and 3 (infographics and commercial UI).
- **Level 1 plates:** clean renders from `video/prt-cinematic`, using the `?clean` flag.
- **Audio:** `source/mix.js` places the VO on the timeline, ducks the ambient score under it, and writes the SRT files.
- **Document:** `source/gen_doc.js` generates `PRODUCTION_BIBLE.md` from the same data, so the timecodes, VO and prices always match the videos.
