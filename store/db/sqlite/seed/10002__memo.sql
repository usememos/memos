INSERT INTO
  memo (
    `id`,
    `uid`,
    `content`,
    `creator_id`,
    `payload`
  )
VALUES
  (
    1,
    "FqaZcg5H6EdGB9ke8kYUcy",
    "#Hello 👋 Welcome to memos.",
    101,
    '{"property": {"tags": ["Hello"]}}'
  );

INSERT INTO
  memo (
    `id`,
    `uid`,
    `content`,
    `creator_id`,
    `visibility`,
    `payload`
  )
VALUES
  (
    2,
    "DCo8442yRnXYPPcKSUAaEb",
    '#TODO 
- [x] Take more photos about **🌄 sunset**;
- [x] Clean the room;
- [ ] Read *📖 The Little Prince*;',
    101,
    'PROTECTED',
    '{"property": {"tags": ["TODO"], "hasTaskList": true, "hasIncompleteTasks":true}}'
  );

INSERT INTO
  memo (
    `id`,
    `uid`,
    `content`,
    `creator_id`,
    `visibility`,
    `payload`
  )
VALUES
  (
    3,
    "ZvH7a6VWMuX5aArtECTj4N",
    '**[Memos](https://github.com/usememos/memos)**: A lightweight, self-hosted memo hub. Open Source and Free to Use. 
**[Slash](https://github.com/yourselfhosted/slash)**: An open source, self-hosted bookmarks and link sharing platform. Save and share your links very easily.',
    101,
    'PUBLIC',
    '{"property": {"hasLink": true}}'
  );

INSERT INTO
  memo (
    `id`,
    `uid`,
    `content`,
    `creator_id`,
    `visibility`,
    `payload`
  )
VALUES
  (
    4,
    "2ad3WzUF4C6pTYXdm2nQC6",
    '#TODO 
- [x] Take more photos about **🌄 sunset**;
- [ ] Clean the classroom;
- [ ] Watch *👦 The Boys*;',
    102,
    'PROTECTED',
    '{"property": {"tags": ["TODO"], "hasTaskList": true, "hasIncompleteTasks":true}}'
  );

INSERT INTO
  memo (
    `id`,
    `uid`,
    `content`,
    `creator_id`,
    `visibility`
  )
VALUES
  (
    5,
    "Pw2awZvxxLK4sPRtHmYuS7",
    '三人行，必有我师焉！👨‍🏫',
    102,
    'PUBLIC'
  );