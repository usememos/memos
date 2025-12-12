export interface Command {
  name: string;
  run: () => string;
  //  Ex.:
  //    [4] == [4, 0]   - cursor offset is 4 chars from initial position
  //    [7, 2]          - cursor offset is 7 chars and 2 next chars selected
  //  If omitted, cursor stays in the end of the inserted string
  cursorRange?: number[];
}

export const editorCommands: Command[] = [
  {
    name: "code",
    run: () => "```js\n\n```", // JS by default as most popular (at least on github)
    cursorRange: [3, 2],
  },
  {
    // Template from github, but with summary initially selected for better UX
    name: "details",
    run: () => "<details><summary>Details</summary>\n\n\n</details>",
    cursorRange: [18, 7],
  },
  {
    name: "image",
    run: () => "![alt text]()", // No need in URL placeholder
    cursorRange: [2, 8],
  },
  {
    name: "link",
    run: () => "[text]()",
    cursorRange: [1, 4],
  },
  {
    name: "table",
    run: () => "| Column1 | Column2 |\n| ------  | ------  |\n| Cell1   | Cell2   |",
    cursorRange: [2, 7],
  },
  {
    name: "todo",
    run: () => "- [ ] ",
  },
  {
    name: "youtube",
    run: () => "[![alt text](https://img.youtube.com/vi/VIDEO_ID/0.jpg)](https://www.youtube.com/watch?v=VIDEO_ID)",
    cursorRange: [3, 8],
  },
];
