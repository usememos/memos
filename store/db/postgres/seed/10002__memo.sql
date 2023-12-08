INSERT INTO memo (id, content, creator_id)
VALUES
  (
    1,
    '#Hello 👋 Welcome to memos.',
    101
  );

INSERT INTO memo (id, content, creator_id, visibility)
VALUES
  (
    2,
    E'#TODO\n- [x] Take more photos about **🌄 sunset**\n- [x] Clean the room\n- [ ] Read *📖 The Little Prince*\n(👆 click to toggle status)',
    101,
    'PROTECTED'
  ),
  (
    3,
    E'**[Slash](https://github.com/yourselfhosted/slash)**: A bookmarking and url shortener, save and share your links very easily.\n**[SQL Chat](https://www.sqlchat.ai)**: Chat-based SQL Client',
    101,
    'PUBLIC'
  ),
  (
    4,
    E'#TODO\n- [x] Take more photos about **🌄 sunset**\n- [ ] Clean the classroom\n- [ ] Watch *👦 The Boys*\n(👆 click to toggle status)',
    102,
    'PROTECTED'
  ),
  (
    5,
    '三人行，必有我师焉！👨‍🏫',
    102,
    'PUBLIC'
  );
