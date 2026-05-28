# Placeholder Bird Tilemaps

These SVGs are pixel-art tile strips for the placeholder component. They should read as small game sprites first, not as decorative illustrations.

## Canvas

- Each frame is 32 by 32 pixels.
- A strip width is `32 * frameCount`; the height stays 32.
- The bird should occupy most of the frame. Use the full height when the animal shape supports it.
- Keep a transparent background.
- Use `shape-rendering="crispEdges"` and integer pixel coordinates.

## Naming

- Start with the animal name, for example `Owl` or `Eagle`.
- Add the animation name when needed, for example `OwlBlink` or `EagleIdle`.
- Do not name assets after UI states or empty-state scenarios.

## Frame Count

Frame count is not fixed. Choose it from the animal and animation:

- short blink: usually 3-5 frames
- quiet idle: usually 4-6 frames
- hop or walk: usually 4-8 frames
- flying, diving, or large body motion: usually 6-10 frames

Avoid padding an animation with duplicate frames just to hit a standard count. A frame should change the pose, expression, feather shape, or weight.

## Shared Style

- Use a strong readable silhouette at 1x.
- Prefer chunky pixel clusters over isolated noisy pixels.
- Use a limited palette with one dark outline, one or two body colors, one highlight color, and one accent.
- Keep eyes readable. At this scale, a 2 by 2 eye or a 1 pixel highlight is often better than a single dark pixel.
- Match visual weight between animals. Different species can have different proportions, but the on-screen size should feel comparable.

## Animation

- Make idle motion local: breathing, wing settling, ear feather movement, tail flicks, head turns, and blinking.
- Avoid moving the entire sprite unless the action is hop, fly, recoil, or collapse.
- Preserve the animal identity in every frame. A blink frame should still clearly read as the same bird.
- Keep the first frame a stable readable pose because it is what appears in reduced-motion rendering.

## Current Assets

- `OwlBlink.svg`: five-frame blink/idle strip with breathing wings, blink, and ear-feather settle.
- `EagleIdle.svg`: four-frame idle strip with breathing, blink, alert head shift, and tail flick.
- `ToucanIdle.svg`: four-frame idle strip with beak bob, chest breathing, blink, tail flick, and settle.
