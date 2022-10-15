import { describe, expect, test } from "@jest/globals";
import { unescape } from "lodash-es";
import { marked } from ".";

describe("test marked parser", () => {
  test("test markdown table", () => {
    const tests = [
      {
        markdown: `text above the table
| a | b | c |
|---|---|---|
| 1 | 2 | 3 |
| 4 | 5 | 6 |
text below the table
`,
        want: `<p>text above the table</p>
<table>
  <thead>
    <tr>
      <th>a</th><th>b</th><th>c</th>
    </tr>
  </thead>
  <tbody>
    <tr><td>1</td><td>2</td><td>3</td></tr><tr><td>4</td><td>5</td><td>6</td></tr>
  </tbody>
</table>
<p>text below the table</p>
`,
      },
      {
        markdown: `| a | b | c |
| 1 | 2 | 3 |
| 4 | 5 | 6 |`,
        want: `<p>| a | b | c |</p>
<p>| 1 | 2 | 3 |</p>
<p>| 4 | 5 | 6 |</p>`,
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
        want: `<pre><code class="language-plaintext">hello world!
</code></pre>`,
      },
      {
        markdown: `test code block

\`\`\`js
console.log("hello world!")
\`\`\``,
        want: `<p>test code block</p>
<p></p>
<pre><code class="language-js"><span class="hljs-variable language_">console</span>.<span class="hljs-title function_">log</span>(<span class="hljs-string">"hello world!"</span>)
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
        want: `<p>My task:</p>
<p><span class='todo-block todo' data-value='TODO'></span>finish my homework</p>
<p><span class='todo-block done' data-value='DONE'>✓</span>yahaha</p>`,
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
        want: `<p>This is a list</p>
<p><span class='ul-block'>•</span>list 123</p>
<p><span class='ol-block'>1.</span>123123</p>`,
      },
    ];

    for (const t of tests) {
      expect(unescape(marked(t.markdown))).toBe(t.want);
    }
  });
  test("parse inline element", () => {
    const tests = [
      {
        markdown: `Link: [baidu](https://baidu.com)`,
        want: `<p>Link: <a class='link' target='_blank' rel='noreferrer' href='https://baidu.com'>baidu</a></p>`,
      },
    ];

    for (const t of tests) {
      expect(unescape(marked(t.markdown))).toBe(t.want);
    }
  });
  test("parse plain link", () => {
    const tests = [
      {
        markdown: `Link:https://baidu.com`,
        want: `<p>Link:<a class='link' target='_blank' rel='noreferrer' href='https://baidu.com'>https://baidu.com</a></p>`,
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
});
