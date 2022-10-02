import { describe, expect, test } from "@jest/globals";
import { marked } from ".";

describe("test marked parser", () => {
  test("parse code block", () => {
    const tests = [
      {
        markdown: `\`\`\`
hello world!
\`\`\``,
        want: `<pre lang=''>
hello world!
</pre>`,
      },
      {
        markdown: `test code block

\`\`\`js
console.log("hello world!")
\`\`\``,
        want: `<p>test code block</p>
<p></p>
<pre lang='js'>
console.log("hello world!")
</pre>`,
      },
    ];

    for (const t of tests) {
      expect(marked(t.markdown)).toBe(t.want);
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
      expect(marked(t.markdown)).toBe(t.want);
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
      expect(marked(t.markdown)).toBe(t.want);
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
      expect(marked(t.markdown)).toBe(t.want);
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
      expect(marked(t.markdown)).toBe(t.want);
    }
  });
});
