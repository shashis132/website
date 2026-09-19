// The voice-over decides the timing. tools/vo-generate.py writes
// projects/<slug>/vo/manifest.json in this shape; compositions build their
// scene timeline from it instead of hard-coding durations.

export type Word = { text: string; start: number; end: number };

export type VoLine = {
  id: string; // scene id, e.g. "s03"
  text: string; // the exact approved line
  file: string; // path under public/, e.g. "trial-signup/vo/s03.mp3"
  duration: number; // seconds
  words: Word[]; // word timings in seconds from the start of the line
};

export type VoManifest = { voice_id: string; model_id: string; lines: VoLine[] };

export type Scene = { id: string; from: number; durationInFrames: number; line: VoLine };

export const secondsToFrames = (s: number, fps: number): number => Math.round(s * fps);

export type TimelineOptions = {
  lead?: number; // silence before the first line, seconds
  gap?: number; // breathing room after each line, seconds
  tail?: number; // hold after the last line, seconds
};

export const buildTimeline = (lines: VoLine[], fps: number, opts: TimelineOptions = {}) => {
  const lead = opts.lead ?? 0.5;
  const gap = opts.gap ?? 0.35;
  const tail = opts.tail ?? 1.2;
  let t = lead;
  const scenes: Scene[] = [];
  for (const line of lines) {
    const from = secondsToFrames(t, fps);
    const durationInFrames = secondsToFrames(line.duration + gap, fps);
    scenes.push({ id: line.id, from, durationInFrames, line });
    t += line.duration + gap;
  }
  return { scenes, totalFrames: secondsToFrames(t - gap + tail, fps) };
};

// Music sits under the voice: full level in gaps, ducked while a line plays.
export const musicVolumeAt = (
  frame: number,
  scenes: Scene[],
  fps: number,
  levels: { bed: number; duck: number; ramp: number } = { bed: 0.35, duck: 0.12, ramp: 0.25 },
): number => {
  const t = frame / fps;
  const rampF = levels.ramp;
  let target = levels.bed;
  for (const s of scenes) {
    const start = s.from / fps;
    const end = start + s.line.duration;
    if (t >= start - rampF && t <= end + rampF) {
      if (t < start) target = Math.min(target, levels.bed - ((levels.bed - levels.duck) * (t - (start - rampF))) / rampF);
      else if (t > end) target = Math.min(target, levels.duck + ((levels.bed - levels.duck) * (t - end)) / rampF);
      else target = levels.duck;
    }
  }
  return target;
};
