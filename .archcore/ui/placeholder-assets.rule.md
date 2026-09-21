---
title: "Placeholder asset conventions"
status: draft
tags:
  - "ui"
---

## Rule
Applies to the pixel-art SVG tile strips in `web/src/components/Placeholder/pieces/` used by the placeholder component.

### Canvas
1. Sprite authors MUST draw each frame at 32 by 32 pixels.
2. Sprite authors MUST make a strip `32 * frameCount` pixels wide and 32 pixels high.
3. Sprite authors SHOULD let the bird occupy most of the frame, using the full height when the animal shape supports it.
4. Sprite authors MUST keep a transparent background.
5. Sprite authors MUST use `shape-rendering="crispEdges"` and integer pixel coordinates.

### Naming
6. Sprite authors MUST start an asset name with the animal name, for example `Owl` or `Eagle`.
7. WHEN an animation name is needed, sprite authors MUST add it after the animal name, for example `OwlBlink` or `EagleIdle`.
8. Sprite authors MUST NOT name assets after UI states or empty-state scenarios.

### Frame count
Frame count is not fixed; sprite authors choose it from the animal and the animation. Usual ranges from the source:

| Animation | Usual frames |
| --- | --- |
| short blink | 3–5 |
| quiet idle | 4–6 |
| hop or walk | 4–8 |
| flying, diving, or large body motion | 6–10 |

9. Sprite authors SHOULD NOT pad an animation with duplicate frames just to hit a standard count.
10. Each frame SHOULD change the pose, expression, feather shape, or weight.

### Shared style
11. Sprite authors MUST use a strong silhouette that reads at 1x.
12. Sprite authors SHOULD prefer chunky pixel clusters over isolated noisy pixels.
13. Sprite authors MUST use a limited palette: one dark outline, one or two body colors, one highlight color, and one accent.
14. Sprite authors MUST keep eyes readable; at this scale a 2 by 2 eye or a 1 pixel highlight is often better than a single dark pixel.
15. Sprite authors MUST match visual weight between animals, so on-screen size feels comparable across species.

### Animation
16. Sprite authors MUST keep idle motion local: breathing, wing settling, ear feather movement, tail flicks, head turns, and blinking.
17. Sprite authors SHOULD NOT move the entire sprite unless the action is hop, fly, recoil, or collapse.
18. Sprite authors MUST preserve the animal identity in every frame. A blink frame should still clearly read as the same bird.
19. Sprite authors MUST keep the first frame a stable, readable pose.

## Rationale
The strips should read as small game sprites first, not as decorative illustrations. The first frame must be stable because it is what appears in reduced-motion rendering. Other rationale: Not recorded in the source.

## Examples
Current assets, registered in @web/src/components/Placeholder/tileSprites.ts:

- @web/src/components/Placeholder/pieces/OwlBlink.svg — five-frame blink/idle strip with breathing wings, blink, and ear-feather settle.
- @web/src/components/Placeholder/pieces/EagleIdle.svg — four-frame idle strip with breathing, blink, alert head shift, and tail flick.
- @web/src/components/Placeholder/pieces/ToucanIdle.svg — four-frame idle strip with beak bob, chest breathing, blink, tail flick, and settle.

## Enforcement
@web/tests/placeholder-pool.test.ts checks the registered sprite names, their frame counts, and the 32 by 32 frame size. Enforcement of the other clauses is not recorded in the source.
