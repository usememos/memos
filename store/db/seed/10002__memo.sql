INSERT INTO
  memo (`id`, `content`, `creator_id`)
VALUES
  (
    1001,
    "#Hello 👋 Welcome to memos.",
    101
  );

INSERT INTO
  memo (
    `id`,
    `content`,
    `creator_id`,
    `visibility`
  )
VALUES
  (
    1002,
    '#TODO 
- [x] Take more photos about **🌄 sunset**;
- [x] Clean the room;
- [ ] Read *📖 The Little Prince*;
(👆 click to toggle status)',
    101,
    'PROTECTED'
  );

INSERT INTO
  memo (
    `id`,
    `content`,
    `creator_id`,
    `visibility`
  )
VALUES
  (
    1003,
    "**[Slash](https://github.com/boojack/slash)**: A bookmarking and url shortener, save and share your links very easily.
![](https://github.com/boojack/slash/raw/main/resources/demo.gif)

**[SQL Chat](https://www.sqlchat.ai)**: Chat-based SQL Client
![](https://www.sqlchat.ai/chat-logo-and-text.webp)",
    101,
    'PUBLIC'
  );

INSERT INTO
  memo (
    `id`,
    `content`,
    `creator_id`,
    `visibility`
  )
VALUES
  (
    1004,
    '#TODO 
- [x] Take more photos about **🌄 sunset**;
- [ ] Clean the classroom;
- [ ] Watch *👦 The Boys*;
(👆 click to toggle status)
',
    102,
    'PROTECTED'
  );

INSERT INTO
  memo (
    `id`,
    `content`,
    `creator_id`,
    `visibility`
  )
VALUES
  (
    1005,
    '三人行，必有我师焉！👨‍🏫',
    102,
    'PUBLIC'
  );