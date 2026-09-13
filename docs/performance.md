# Performance investigation — 2026-09-13

The supplied Chrome recording, `Trace-20260913T131601.json.gz`, contained 847 animation callbacks across a 21.58-second animation segment (about 39 FPS). Median callback duration was 3.11 ms. The application requested another frame unconditionally, including when the room was idle. Every frame repeated the scene, reflections, depth-of-field, shadow, bloom, and other postprocessing work, just to change a very faint grain pattern.

The renderer now sleeps at idle and wakes on input or animation. Film grain remains animated using a cached noise tile on a compositor layer. Reflections update once per rendered frame; shadow maps update for moving buttons; the depth image updates for camera or geometry changes. A floating loss amount only updates its DOM transform and opacity. Audio suspends 250 ms after the final sound has ended, and resumes for the next sound. Hidden tabs cancel scheduled rendering and resume unfinished spins when shown again.

Comparison against commit `a356237`, using the same local Chrome, 1440×1000 viewport, device scale factor 2, and deterministic outcomes. Both versions retained renderer pixel ratio 1.75. Each measurement is one run, so active timings will vary with hardware and workload.

| Workload | Before: WebGL draws | After: WebGL draws | Before: main-thread busy | After: main-thread busy |
| --- | ---: | ---: | ---: | ---: |
| Idle, 5 seconds | 112,382 | 0 | 13.10% | 0.08% |
| Spin, approximately 3.1 seconds | 64,341 | 27,520 | 22.28% | 20.91% |
| Idle after a spin, 5 seconds | 116,444 | 0 | 13.16% | 0.07% |
| Camera movement and settling, approximately 2.7 seconds | 61,471 | 27,664 | 12.07% | 9.72% |
| Speciala, 2.5 seconds | 66,174 | 32,785 | 15.26% | 13.36% |
| Idle after Speciala, 3 seconds | 72,814 | 0 | 13.29% | 0.08% |

Draw counts instrument WebGL draw entry points, including instanced draws. Main-thread busy time is Chrome DevTools Protocol `TaskDuration` divided by wall time; it is not whole-browser CPU, GPU utilization, or a battery-life measurement. The lightweight grain animation still uses the compositor. Graphics resources stay resident for immediate interaction; this change does not promise to eliminate Chrome's graphics memory allocation. The final audio state after Speciala was `suspended`.

Desktop and mobile image comparisons at identical camera positions had mean absolute RGB differences of 0.626 and 0.669 levels out of 255. No pixel differed by more than 8 levels. The differences were confined to the changed grain implementation. Geometry, materials, rendering resolution, reflections, depth precision and blur kernel, bloom, and the 3D payout effects were retained.

Validation: 11 unit tests and 13 browser tests passed. Browser coverage includes every payout tier, Speciala, mobile layouts, offline play, audio, physical buttons, camera movement, fullscreen, idle frame counts, shadow/depth cache invalidation, and visibility-transition handling. Visibility transitions are simulated at the document event boundary in the regression test.

To repeat the benchmark, build the desired revision and save its `dist/index.html`, then run:

```sh
node scripts/measure-performance.mjs /path/to/saved/index.html /tmp/performance.json
```

Without arguments, it measures `dist/index.html` and writes `test-results/performance.json`. Run versions sequentially with other GPU-intensive work closed. The benchmark uses an isolated headless Chrome session and does not modify the production game or its randomness.
