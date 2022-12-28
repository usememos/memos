/* eslint-disable no-irregular-whitespace */
import { describe, expect, test } from "@jest/globals";
import { unescape } from "lodash-es";
import { marked } from ".";

describe("test marked parser", () => {
  test("horizontal rule", () => {
    const tests = [
      {
        markdown: `---
This is some text after the horizontal rule.
___
This is some text after the horizontal rule.
***
This is some text after the horizontal rule.`,
        want: `<hr><p>This is some text after the horizontal rule.</p><hr><p>This is some text after the horizontal rule.</p><hr><p>This is some text after the horizontal rule.</p>`,
      },
    ];
    for (const t of tests) {
      expect(unescape(marked(t.markdown))).toBe(t.want);
    }
  });
  test("parse code block", () => {
    const tests = [
      {
        markdown: `\`\`\`
hello world!
\`\`\``,
        want: `<pre><button class="codeblock-copy-btn">copy</button><code class="language-plaintext">hello world!
</code></pre>`,
      },
      {
        markdown: `test code block

\`\`\`js
console.log("hello world!")
\`\`\``,
        want: `<p>test code block</p><br><pre><button class="codeblock-copy-btn">copy</button><code class="language-js"><span class="hljs-variable language_">console</span>.<span class="hljs-title function_">log</span>(<span class="hljs-string">"hello world!"</span>)
</code></pre>`,
      },
    ];

    for (const t of tests) {
      expect(unescape(marked(t.markdown))).toBe(t.want);
    }
  });
  test("parse todo list block", () => {
    const tests = [
      {
        markdown: `My task:
- [ ] finish my homework
- [x] yahaha`,
        want: `<p>My task:</p><p class='li-container'><span class='todo-block todo' data-value='TODO'></span><span>finish my homework</span></p><p class='li-container'><span class='todo-block done' data-value='DONE'>✓</span><span>yahaha</span></p>`,
      },
    ];

    for (const t of tests) {
      expect(unescape(marked(t.markdown))).toBe(t.want);
    }
  });
  test("parse list block", () => {
    const tests = [
      {
        markdown: `This is a list
* list 123
1. 123123`,
        want: `<p>This is a list</p><p class='li-container'><span class='ul-block'>•</span><span>list 123</span></p><p class='li-container'><span class='ol-block'>1.</span><span>123123</span></p>`,
      },
    ];

    for (const t of tests) {
      expect(unescape(marked(t.markdown))).toBe(t.want);
    }
  });
  test("parse inline element", () => {
    const tests = [
      {
        markdown: `Link: [baidu](https://baidu.com#1231)`,
        want: `<p>Link: <a class='link' target='_blank' rel='noreferrer' href='https://baidu.com#1231'>baidu</a></p>`,
      },
    ];

    for (const t of tests) {
      expect(unescape(marked(t.markdown))).toBe(t.want);
    }
  });
  test("parse inline code within inline element", () => {
    const tests = [
      {
        markdown: `Link: [\`baidu\`](https://baidu.com)`,
        want: `<p>Link: <a class='link' target='_blank' rel='noreferrer' href='https://baidu.com'><code>baidu</code></a></p>`,
      },
    ];

    for (const t of tests) {
      expect(unescape(marked(t.markdown))).toBe(t.want);
    }
  });
  test("parse plain link", () => {
    const tests = [
      {
        markdown: `Link:https://baidu.com#1231`,
        want: `<p>Link:<a class='link' target='_blank' rel='noreferrer' href='https://baidu.com#1231'>https://baidu.com#1231</a></p>`,
      },
    ];

    for (const t of tests) {
      expect(unescape(marked(t.markdown))).toBe(t.want);
    }
  });
  test("parse inline code", () => {
    const tests = [
      {
        markdown: `Code: \`console.log("Hello world!")\``,
        want: `<p>Code: <code>console.log("Hello world!")</code></p>`,
      },
    ];

    for (const t of tests) {
      expect(unescape(marked(t.markdown))).toBe(t.want);
    }
  });
  test("parse bold and em text", () => {
    const tests = [
      {
        markdown: `Important: **Minecraft**`,
        want: `<p>Important: <strong>Minecraft</strong></p>`,
      },
      {
        markdown: `Em: *Minecraft*`,
        want: `<p>Em: <em>Minecraft</em></p>`,
      },
      {
        markdown: `Important: ***Minecraft/123***`,
        want: `<p>Important: <strong><em>Minecraft/123</em></strong></p>`,
      },
      {
        markdown: `Important: ***[baidu](https://baidu.com)***`,
        want: `<p>Important: <strong><em><a class='link' target='_blank' rel='noreferrer' href='https://baidu.com'>baidu</a></em></strong></p>`,
      },
    ];

    for (const t of tests) {
      expect(unescape(marked(t.markdown))).toBe(t.want);
    }
  });
  test("parse full width space", () => {
    const tests = [
      {
        markdown: `　　line1
　　line2`,
        want: `<p>　　line1</p><p>　　line2</p>`,
      },
    ];
    for (const t of tests) {
      expect(unescape(marked(t.markdown))).toBe(t.want);
    }
  });
  test("parse heading", () => {
    const tests = [
      {
        markdown: `# 123 `,
        want: `<h1>123 </h1>`,
      },
      {
        markdown: `## 123 `,
        want: `<h2>123 </h2>`,
      },
    ];
    for (const t of tests) {
      expect(unescape(marked(t.markdown))).toBe(t.want);
    }
  });
});
