"use client";

import { useRef, useState } from "react";
import { Play } from "lucide-react";

type PhoneFrameProps = {
  /** MP4 URL (e.g. /videos/get-started.mp4). When omitted, a "coming soon" placeholder shows. */
  src?: string;
  /** Poster image shown before play / when no src. */
  poster?: string;
  /** Caption under the device. */
  caption?: string;
  /**
   * "loop"     → muted autoplay loop, for ambient hero/feature demos.
   * "tutorial" → poster + tap-to-play with native controls (default for /tutorials).
   */
  mode?: "loop" | "tutorial";
  /** Accessible label for the video / placeholder. */
  label?: string;
  /** Placeholder text when there's no video yet. */
  comingSoonText?: string;
  className?: string;
};

/**
 * A CSS-drawn phone mockup that plays a video inside the screen. No image
 * assets needed for the frame itself — it's pure markup so it stays crisp at
 * any size and matches the leaf/ink brand. Drop an MP4 into /public/videos and
 * pass its path as `src`; until then the screen shows a branded placeholder so
 * the marketing pages look complete.
 */
export function PhoneFrame({
  src,
  poster,
  caption,
  mode = "tutorial",
  label,
  comingSoonText = "Demo video coming soon",
  className
}: PhoneFrameProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [playing, setPlaying] = useState(false);
  // If the MP4 isn't there yet (404) the <video> errors — fall back to the
  // branded placeholder so the page still looks complete. Once the file is
  // dropped into /public/videos it plays automatically, no code change.
  const [failed, setFailed] = useState(false);
  const showVideo = Boolean(src) && !failed;

  function play() {
    const v = videoRef.current;
    if (!v) return;
    v.play();
    setPlaying(true);
  }

  return (
    <figure className={`mx-auto flex w-full max-w-[280px] flex-col items-center ${className ?? ""}`}>
      {/* Device body */}
      <div className="relative w-full rounded-[2.6rem] border border-ink/15 bg-ink p-2.5 shadow-2xl">
        {/* Screen */}
        <div className="relative aspect-[9/19.5] w-full overflow-hidden rounded-[2rem] bg-black">
          {/* Notch / dynamic island */}
          <div className="pointer-events-none absolute left-1/2 top-2 z-10 h-5 w-24 -translate-x-1/2 rounded-full bg-black/90 ring-1 ring-white/10" />

          {showVideo ? (
            mode === "loop" ? (
              // Ambient demo: muted autoplay loop (accessible — no sound, decorative).
              <video
                className="h-full w-full object-cover"
                src={src}
                poster={poster}
                autoPlay
                muted
                loop
                playsInline
                aria-label={label}
                onError={() => setFailed(true)}
              />
            ) : (
              // Tutorial: poster until the viewer taps play, then native controls.
              <>
                <video
                  ref={videoRef}
                  className="h-full w-full object-cover"
                  src={src}
                  poster={poster}
                  controls={playing}
                  playsInline
                  preload="metadata"
                  aria-label={label}
                  onPause={() => setPlaying(false)}
                  onError={() => setFailed(true)}
                />
                {!playing ? (
                  <button
                    type="button"
                    onClick={play}
                    aria-label={label ? `Play: ${label}` : "Play video"}
                    className="focus-ring absolute inset-0 z-[5] flex items-center justify-center bg-ink/20 transition-colors hover:bg-ink/10"
                  >
                    <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white/95 text-leaf shadow-lg">
                      <Play size={26} className="ml-1" aria-hidden />
                    </span>
                  </button>
                ) : null}
              </>
            )
          ) : (
            // No video yet → branded placeholder.
            <div
              className="flex h-full w-full flex-col items-center justify-center gap-3 bg-gradient-to-b from-leaf/15 via-white to-smoke px-6 text-center"
              aria-label={label}
            >
              {poster ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={poster} alt={label ?? ""} className="absolute inset-0 h-full w-full object-cover" />
              ) : null}
              <span className="relative flex h-14 w-14 items-center justify-center rounded-full bg-white text-leaf shadow">
                <Play size={22} className="ml-0.5" aria-hidden />
              </span>
              <span className="relative text-sm font-black text-ink/70">{comingSoonText}</span>
            </div>
          )}
        </div>
      </div>
      {caption ? (
        <figcaption className="mt-4 text-center text-sm font-bold text-ink/65">{caption}</figcaption>
      ) : null}
    </figure>
  );
}
