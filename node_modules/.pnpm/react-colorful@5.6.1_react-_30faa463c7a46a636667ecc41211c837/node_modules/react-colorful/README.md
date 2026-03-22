<div align="center">
  <a href="https://omgovich.github.io/react-colorful">
    <img src="demo/src/assets/design.png" width="229" height="233" alt="react-colorful" />
  </a>
</div>

<div align="center">
  <a href="https://npmjs.org/package/react-colorful">
    <img alt="npm" src="https://img.shields.io/npm/v/react-colorful.svg?labelColor=da248d&color=6ead0a" />
  </a>
  <a href="https://github.com/omgovich/react-colorful/actions">
    <img alt="build" src="https://img.shields.io/github/workflow/status/omgovich/react-colorful/Node.js%20CI/master.svg?labelColor=da248d&color=6ead0a" />
  </a>
  <a href="https://codecov.io/gh/omgovich/react-colorful">
    <img alt="coverage" src="https://img.shields.io/codecov/c/github/omgovich/react-colorful.svg?labelColor=da248d&color=6ead0a" />
  </a>
  <a href="https://npmjs.org/package/react-colorful">
    <img alt="no dependencies" src="https://badgen.net/bundlephobia/dependency-count/react-colorful?labelColor=da248d&color=6ead0a" />
  </a>
  <a href="https://bundlephobia.com/result?p=react-colorful">
    <img alt="tree-shakeable" src="https://badgen.net/bundlephobia/tree-shaking/react-colorful?labelColor=da248d&color=6ead0a" />
  </a>
  <a href="https://npmjs.org/package/react-colorful">
    <img alt="types included" src="https://badgen.net/npm/types/react-colorful?labelColor=da248d&color=6ead0a" />
  </a>
</div>

<div align="center">
  <strong>react-colorful</strong> is a tiny color picker component for React and Preact apps.
</div>

## Features

- 🗜 **Small**: Just 2,8 KB gzipped ([13x lighter](#why-react-colorful) than **react-color**).
- 🌳 **Tree-shakeable**: Only the parts you use will be imported into your app's bundle.
- 🚀 **Fast**: Built with hooks and functional components only.
- 🛡 **Bulletproof**: Written in strict TypeScript and has 100% test coverage.
- 🗂 **Typed**: Ships with [types included](#typescript-support)
- 😍 **Simple**: The interface is straightforward and easy to use.
- 👫 **Cross-browser**: Works out-of-the-box for most browsers, regardless of version.
- 📲 **Mobile-friendly**: Supports mobile devices and touch screens.
- 💬 **Accessible**: Follows the [WAI-ARIA](https://www.w3.org/WAI/standards-guidelines/aria/) guidelines to support users of assistive technologies.
- 💨 **No dependencies**

## Live demos

- [Website](https://omgovich.github.io/react-colorful)
- [HEX Color Picker (CodeSandbox)](https://codesandbox.io/s/react-colorful-demo-u5vwp)
- [RGBA Color Picker (CodeSandbox)](https://codesandbox.io/s/react-colorful-rgb-o9q0t)

## Table of Contents

- [Getting Started](#getting-started)
- [Supported Color Models](#supported-color-models)
- [Customization](#customization)
- [How to paste or type a color?](#how-to-paste-or-type-a-color)
- [Code Recipes](#code-recipes)
- [TypeScript Support](#typescript-support)
- [Usage with Preact](#usage-with-preact)
- [Browser Support](#browser-support)
- [Why react-colorful?](#why-react-colorful)
- [Projects using react-colorful](#projects-using-react-colorful)
- [Ports](#ports)

## Getting Started

```
npm install react-colorful
```

```js
import { HexColorPicker } from "react-colorful";

const YourComponent = () => {
  const [color, setColor] = useState("#aabbcc");
  return <HexColorPicker color={color} onChange={setColor} />;
};
```

## Supported Color Models

We provide 12 additional color picker components for different color models, unless your app needs a HEX string as an input/output format.

<details>
  <summary>How to use another color model</summary>

#### Available pickers

| Import                      | Value example                      |
| --------------------------- | ---------------------------------- |
| `{ HexColorPicker }`        | `"#ffffff"`                        |
| `{ HexAlphaColorPicker }`   | `"#ffffff88"`                      |
| `{ RgbColorPicker }`        | `{ r: 255, g: 255, b: 255 }`       |
| `{ RgbaColorPicker }`       | `{ r: 255, g: 255, b: 255, a: 1 }` |
| `{ RgbStringColorPicker }`  | `"rgb(255, 255, 255)"`             |
| `{ RgbaStringColorPicker }` | `"rgba(255, 255, 255, 1)"`         |
| `{ HslColorPicker }`        | `{ h: 0, s: 0, l: 100 }`           |
| `{ HslaColorPicker }`       | `{ h: 0, s: 0, l: 100, a: 1 }`     |
| `{ HslStringColorPicker }`  | `"hsl(0, 0%, 100%)"`               |
| `{ HslaStringColorPicker }` | `"hsla(0, 0%, 100%, 1)"`           |
| `{ HsvColorPicker }`        | `{ h: 0, s: 0, v: 100 }`           |
| `{ HsvaColorPicker }`       | `{ h: 0, s: 0, v: 100, a: 1 }`     |
| `{ HsvStringColorPicker }`  | `"hsv(0, 0%, 100%)"`               |
| `{ HsvaStringColorPicker }` | `"hsva(0, 0%, 100%, 1)"`           |

#### Code example

```js
import { RgbColorPicker } from "react-colorful";

const YourComponent = () => {
  const [color, setColor] = useState({ r: 50, g: 100, b: 150 });
  return <RgbColorPicker color={color} onChange={setColor} />;
};
```

[Live demo →](https://codesandbox.io/s/react-colorful-rgb-o9q0t)

</details>

## Customization

The easiest way to tweak **react-colorful** is to create another stylesheet to override the default styles.

```css
.your-component .react-colorful {
  height: 240px;
}
.your-component .react-colorful__saturation {
  border-radius: 4px 4px 0 0;
}
.your-component .react-colorful__hue {
  height: 40px;
  border-radius: 0 0 4px 4px;
}
.your-component .react-colorful__hue-pointer {
  width: 12px;
  height: inherit;
  border-radius: 0;
}
```

[See examples →](https://codesandbox.io/s/react-colorful-customization-demo-mq85z?file=/src/styles.css)

## How to paste or type a color?

As you probably noticed the color picker itself does not include an input field, but do not worry if you need one. **react-colorful** is a modular library that allows you to build any picker you need. Since `v2.1` we provide an additional component that works perfectly in pair with our color picker.

<details>
  <summary>How to use <code>HexColorInput</code></summary><br />

```js
import { HexColorPicker, HexColorInput } from "react-colorful";

const YourComponent = () => {
  const [color, setColor] = useState("#aabbcc");
  return (
    <div>
      <HexColorPicker color={color} onChange={setColor} />
      <HexColorInput color={color} onChange={setColor} />
    </div>
  );
};
```

[Live demo →](https://codesandbox.io/s/react-colorful-hex-input-demo-0k2fx)

| Property   | Default | Description                                  |
| ---------- | ------- | -------------------------------------------- |
| `alpha`    | `false` | Allows `#rgba` and `#rrggbbaa` color formats |
| `prefixed` | `false` | Enables `#` prefix displaying                |

`HexColorInput` does not have any default styles, but it also accepts all properties that a regular `input` tag does (such as `className`, `placeholder` and `autoFocus`). That means you can place and modify this component as you like. Also, that allows you to combine the color picker and input in different ways:

```jsx
<HexColorInput color={color} onChange={setColor} placeholder="Type a color" prefixed alpha />
```

</details>

## Code Recipes

- [Value debouncing](https://codesandbox.io/s/dgqn0?file=/src/DebouncedPicker.js)
- [Popover picker](https://codesandbox.io/s/opmco?file=/src/PopoverPicker.js)
- [Preset colors (color squares)](https://codesandbox.io/s/bekry?file=/src/SwatchesPicker.js)
- [Picker that accepts any color input](https://codesandbox.io/s/6fp23?file=/src/CustomPicker.js)
- [Text field to be able to type/copy/paste a color](https://codesandbox.io/s/0k2fx?file=/src/App.js)
- [Custom styles and layout](https://codesandbox.io/s/mq85z?file=/src/styles.css)

## TypeScript Support

**react-colorful** supports TypeScript and ships with types in the library itself; no need for any other install.

<details>
  <summary>How you can get the most from our TypeScript support</summary><br />

While not only typing its own functions and variables, it can also help you type yours. Depending on the component you are using, you can also import the type that is associated with the component. For example, if you are using our HSL color picker component, you can also import the `HSL` type.

```ts
import { HslColorPicker, HslColor } from "react-colorful";

const myHslValue: HslColor = { h: 0, s: 0, l: 0 };
```

Take a look at [Supported Color Models](#supported-color-models) for more information about the types and color formats you may want to use.

</details>

## Usage with Preact

**react-colorful** will work flawlessly with Preact out-of-the-box if you are using [WMR](https://github.com/preactjs/wmr), [Preact-CLI](https://github.com/preactjs/preact-cli), [NextJS with Preact](https://github.com/vercel/next.js/tree/canary/examples/using-preact), or a few other tools/boilerplates thanks to aliasing.

If you are using another solution, please refer to the [Aliasing React to Preact](https://preactjs.com/guide/v10/getting-started#aliasing-react-to-preact) section of the Preact documentation.

<details>
  <summary>Preact + Typescript</summary><br />

**react-colorful**, like all other React + TS projects, can potentially cause issues in a Preact + TS application if you have the `@types/react` package installed, either as a direct dependency or a dependency of a dependency. For example, the Preact TS template comes with `@types/enzyme` which has `@types/react` as a dependency.

To fix this, create a `declaration.d.ts` file or add to your existing:

```
import React from "react";

declare global {
    namespace React {
        interface ReactElement {
            nodeName: any;
            attributes: any;
            children: any;
        }
    }
}
```

This will correct the types and allow you to use **react-colorful** along with many other React + TS libraries in your Preact + TS application.

</details>

## Browser Support

It would be an easier task to list all of the browsers and versions that **react-colorful** does not support! We regularly test against browser versions going all the way back to 2013 and this includes IE11.

**react-colorful** works out-of-the-box for most browsers, regardless of version, and only requires an `Object.assign` polyfill be provided for full IE11 support.

## Why react-colorful?

Today each dependency drags more dependencies and increases your project’s bundle size uncontrollably. But size is very important for everything that intends to work in a browser.

**react-colorful** is a simple color picker for those who care about their bundle size and client-side performance. It is fast and lightweight because:

- has no dependencies (no risks in terms of vulnerabilities, no unexpected bundle size changes);
- built with hooks and functional components only (no classes and polyfills for them);
- ships only a minimal amount of manually optimized color conversion algorithms (while most of the popular pickers import entire color manipulation libraries that increase the bundle size by more than 10 KB and make your app slower).

To show you the problem that **react-colorful** is trying to solve, we have performed a simple benchmark (using [bundlephobia.com](https://bundlephobia.com)) against popular React color picker libraries:

| Name               | Bundle size                                                                                                                        | Bundle size (gzip)                                                                                                                    | Dependencies                                                                                                                                    |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| **react-colorful** | [![](https://badgen.net/bundlephobia/min/react-colorful?color=6ead0a&label=)](https://bundlephobia.com/result?p=react-colorful)    | [![](https://badgen.net/bundlephobia/minzip/react-colorful?color=6ead0a&label=)](https://bundlephobia.com/result?p=react-colorful)    | [![](https://badgen.net/bundlephobia/dependency-count/react-colorful?color=6ead0a&label=)](https://bundlephobia.com/result?p=react-colorful)    |
| react-color        | [![](https://badgen.net/bundlephobia/min/react-color?color=red&label=)](https://bundlephobia.com/result?p=react-color)             | [![](https://badgen.net/bundlephobia/minzip/react-color?color=red&label=)](https://bundlephobia.com/result?p=react-color)             | [![](https://badgen.net/bundlephobia/dependency-count/react-color?color=red&label=)](https://bundlephobia.com/result?p=react-color)             |
| react-input-color  | [![](https://badgen.net/bundlephobia/min/react-input-color?color=red&label=)](https://bundlephobia.com/result?p=react-input-color) | [![](https://badgen.net/bundlephobia/minzip/react-input-color?color=red&label=)](https://bundlephobia.com/result?p=react-input-color) | [![](https://badgen.net/bundlephobia/dependency-count/react-input-color?color=red&label=)](https://bundlephobia.com/result?p=react-input-color) |
| rc-color-picker    | [![](https://badgen.net/bundlephobia/min/rc-color-picker?color=red&label=)](https://bundlephobia.com/result?p=rc-color-picker)     | [![](https://badgen.net/bundlephobia/minzip/rc-color-picker?color=red&label=)](https://bundlephobia.com/result?p=rc-color-picker)     | [![](https://badgen.net/bundlephobia/dependency-count/rc-color-picker?color=red&label=)](https://bundlephobia.com/result?p=rc-color-picker)     |

## Projects using react-colorful

<details>
  <summary><a href="https://storybook.js.org/">Storybook</a> — the most widely used open-source tool for developing UI components</summary>

  <a href="https://storybook.js.org/">
    <img src="demo/src/assets/storybook.png" width="551" alt="Storybook" />
  </a>
</details>

<details>
  <summary><a href="https://resume.io">Resume.io</a> — online resume builder with over 9,400,000 users worldwide</summary>

  <a href="https://resume.io/">
    <img src="demo/src/assets/resume-io.png" width="873" alt="resume.io" />
  </a>
</details>

<details>
  <summary><a href="https://wireflow.co/">Wireflow.co</a> — free tool for creating modern user flow prototypes</summary>

  <a href="https://wireflow.co/">
    <img src="demo/src/assets/wireflow-co.png" width="1222" alt="wireflow.co" />
  </a>
</details>

<details>
  <summary><a href="https://www.magicpattern.design/">MagicPattern.design</a> — unique geometric pattern generator</summary>

  <a href="https://www.magicpattern.design/">
    <img src="demo/src/assets/magicpattern-design.jpg" width="943" alt="magicpattern.design" />
  </a>
</details>

<details>
  <summary><a href="https://viewst.com/">Viewst.com</a> — online tool for designing, creating and automating ad campaigns</summary>

  <a href="https://viewst.com/">
    <img src="demo/src/assets/viewst.png" width="1159" alt="viewst.com" />
  </a>
</details>

<details>
  <summary><a href="https://omatsuri.app">Omatsuri.app</a> — progressive web application with a lot of different frontend focused tools</summary>

  <a href="https://omatsuri.app">
    <img src="demo/src/assets/omatsuri-app.png" width="1223" alt="omatsuri.app" />
  </a>
</details>

<details>
  <summary><a href="https://github.com/pmndrs/leva">Leva</a> — open source extensible GUI panel made for React</summary>

  <a href="https://github.com/pmndrs/leva">
    <img src="demo/src/assets/leva.png" width="1223" alt="pmndrs/leva" />
  </a>
</details>

<details>
  <summary><a href="https://www.composable.art">Composable</a> — online tool for creating custom vector illustrations</summary>

  <a href="https://www.composable.art">
    <img src="demo/src/assets/composable.png" width="745" alt="composable.art" />
  </a>
</details>

## Backers and sponsors

<a href="https://opencollective.com/react-colorful"><img src="https://opencollective.com/react-colorful/individuals.svg?width=890"></a>

## Ports

Not using React or Preact? Not a problem! Check out the list of react-colorful ports adapted to your favourite framework or technology of choice:

- **[vanilla-colorful](https://github.com/web-padawan/vanilla-colorful)** — a react-colorful reimplementation in vanilla Custom Elements, generously ported by [@web-padavan](https://github.com/web-padawan).

- **[angular-colorful](https://github.com/fil0157/angular-colorful)** — a react-colorful rewritten for use with the Angular framework, lovingly ported by [@fil0157](https://github.com/fil0157).

If your port is not in the list, reach us out via [GitHub issues](https://github.com/omgovich/react-colorful/issues).
