### 5.6.1

- Update export settings to fix Jet 28 issues (via #191)

### 5.6.0

- Add new `HexAlphaColorPicker` component (via #186)
- Fix types export for TYpeScript 4.7. Thanks to @AnotherHermit (via #189)
- Improve ARIA attribute values for sliders. Thanks to @aitchiss (via #177)

### 5.5.1

- Fix embedding into `<iframe>`. The component is rendered correctly by libraries like `react-frame-component`. Thanks to @leoc4e (via #166)

### 5.5.0

- Multitouch! ✌️ Thanks to @xnimorz (via #158)

### 5.4.0

- Add new `alpha` property for `HexColorInput` to allow "#rgba" and "#rrggbbaa" formats (via #155)

### 5.3.1

- Fix potential memory leaks and improve the performance. Thanks to @xnimorz (via #151)

### 5.3.0

- Add new `prefixed` property for `HexColorInput` to display "#" prefix (via #146)

### 5.2.3

- Fix: Make the picker take focus on click (via #143)

### 5.2.2

- Fix "Unable to preventDefault inside passive event listener" (via #141)

### 5.2.1

- Fix rounded corner rendering bug (via #140)

### 5.2.0

- Improve input color parsers to support more CSS color notations and units (via #133)

### 5.1.4

- Fix `.mjs` file publishing (via #129)

### 5.1.3

- Export `.mjs` file to improve different environments and bundlers support. Thanks to @rschristian (via #127)

### 5.1.2

- Add `"default"` fallback to the exports map (via #124)

### 5.1.1

- Fix `setNonce` type declaration file publishing (via #123)

### 5.1.0

- The picker complies with the strict CSP (Content Security Policy). The `style` tag added by the component uses a nonce hash provided by Webpack or the one defined manually by the new `setNonce` function (via #121)

### 5.0.1

- The picker supports all HTML attributes and DOM events that a regular tag does (e.g. `id` or `onMouseEnter` (via #119)

## 5.0

- The library is 100% CSS-in-JS now. No need to import the CSS file to render the picker properly (via #101)

### 4.4.4

- Fix bug when a user releases the mouse button outside of the document bounds (via #99)

### 4.4.3

- Get rid of `useLayoutEffect` warning when using on the server (via #95)

### 4.4.2

- Fix CSS loading in Webpack v5 (via #91)

### 4.4.1

- Disable static class names minification (via #86)

### 4.4.0

- Migrate from CSS modules to static class names (via #84)
- Better Skypack support. Thanks to @rschristian (via #83)

### 4.3.0

- Better React 17 support (via #80)

### 4.2.0

- Round output values (via #77)

### 4.1.4

- Fix pointer rendering bug on Safari 14 (via #74)

### 4.1.3

- Do not display the default focus styles

### 4.1.2

- 100% code coverage

### 4.1.1

- Better Internet Explorer 11 support (via #65)

### 4.1.0

- The picker follows the WAI-ARIA guidelines to support users of assistive technologies. The component is completely accessible with keyboard navigation: you can focus on any picker's part using the Tab button and change the color with the arrow keys. Made by @omgovich (via #63)

### 4.0.7

- Simplify gradient CSS styles

### 4.0.6

- Improve pasting from clipboard to `HexColorInput`

### 4.0.5

- Fix: Fast Tap and Release in iOS Safari (via #56)
- Adding `HsvStringColorPicker` and `HsvaStringColorPicker` components. Thanks to @rschristian (via #48)

### 4.0.4

- Resolving `TouchEvent` error on Firefox. Thanks to @rschristian (via #53)

### 4.0.3

- Improve `Interactive` internal typing (via #50)

### 4.0.2

- Allow to pass custom `onBlur` callback to `HexInput` (via #49)
- Improve `HexColorInput` types (via #49)

### 4.0.1

- Add alpha picker demos

## 4.0

- Alpha channel support (via #47)
- Additional components to work with RGBA, HSLA, HSVA color models (via #47)

### 3.0.3

- Improve TypeScript tooling. Thanks to @rschristian (via #45)

### 3.0.2

- Fix `sideEffects` to keep CSS-files

## 3.0

- Migrate to named exports. Thanks to @rschristian (via #42)
- Mark the library as side-effect-free and add tree-shaking support. Thanks to @rschristian (via #42)
- More consistent public component and type names. Thanks to @rschristian (via #42)
- Fix type definitions: make all `HexInput` props optional
- Enhance internal event type definitions. Thanks to @byr-gdp (via #41)
- Escape from "useCallback hell" and improve performance by adding `useEventCallback` hook. Thanks to @jeetiss (via #40)

### 2.3.1

- Extend allowed `HexInput` props with `HTMLInputElement`

### 2.3.0

- The entire codebase was rewritten in TypeScript by @rschristian (via #23)

### 2.2.1

- Fix type definitions: make all of the picker props optional

### 2.2.0

- TypeScript types are now bundled with the library. Thanks to @rschristian (via #22)

### 2.1.2

- Make the pointer grabbable even if it is outside of the picket bounds (via #21)

### 2.1.1

- Fix bug if user taps on the picker and does not move the pointer afterward

### 2.1.0

- Add `HexInput` component that allows to paste and type a HEX color

### 2.0.3

- Reduce the number of folders published to NPM
- Rewrite `Interactive` to make the bundle lighter

### 2.0.2

- Fix HSV to RGB conversion algorithm
- Rewrite utils to make the bundler lighter

### 2.0.1

- Update docs and tooling

## 2.0

- Support new input/output formats: RGB object, RGB string, HSL object, HSL string, HSV object

### 1.2.5

- Test components with Jest and React Testing Library

### 1.2.4

- Fix `box-sizing` of the pointers

### 1.2.3

- Refactor `Interactive` a bit in order to make the package lighter

### 1.2.2

- Get rid of unused `className` props in `Hue` and `Saturation` components

### 1.2.1

- Add `equalHex` and `equalColorObjects` utils and write tests for them

### 1.2.0

- Make the package dependency-free
- Do not trigger `onChange` after the mounting

### 1.1.0

- Migrate from color-fns to @swiftcarrot/color-fns which is 40% lighter

### 1.0.1

- Use proper JSX pragma for React. Thanks to @jeetiss

## 1.0

- HEX color picker component
