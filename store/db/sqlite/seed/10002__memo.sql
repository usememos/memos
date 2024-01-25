INSERT INTO
  memo (
    `id`,
    `resource_name`,
    `content`,
    `creator_id`
  )
VALUES
  (
    1,
    "hello",
    "#Hello 👋 Welcome to memos.",
    101
  );

INSERT INTO
  memo (
    `id`,
    `resource_name`,
    `content`,
    `creator_id`,
    `visibility`
  )
VALUES
  (
    2,
    "todo",
    '#TODO 
- [x] Take more photos about **🌄 sunset**;
- [x] Clean the room;
- [ ] Read *📖 The Little Prince*;',
    101,
    'PROTECTED'
  );

INSERT INTO
  memo (
    `id`,
    `resource_name`,
    `content`,
    `creator_id`,
    `visibility`
  )
VALUES
  (
    3,
    "links",
    '**[Memos](https://github.com/usememos/memos)**: A lightweight, self-hosted memo hub. Open Source and Free forever. 
**[Slash](https://github.com/yourselfhosted/slash)**: An open source, self-hosted bookmarks and link sharing platform. Save and share your links very easily.',
    101,
    'PUBLIC'
  );

INSERT INTO
  memo (
    `id`,
    `resource_name`,
    `content`,
    `creator_id`,
    `visibility`
  )
VALUES
  (
    4,
    "todo2",
    '#TODO 
- [x] Take more photos about **🌄 sunset**;
- [ ] Clean the classroom;
- [ ] Watch *👦 The Boys*;',
    102,
    'PROTECTED'
  );

INSERT INTO
  memo (
    `id`,
    `resource_name`,
    `content`,
    `creator_id`,
    `visibility`
  )
VALUES
  (
    5,
    "words",
    '三人行，必有我师焉！👨‍🏫',
    102,
    'PUBLIC'
  );