-- Demo User
INSERT INTO user (id,username,role,nickname,password_hash) VALUES(1,'demo','ADMIN','Demo User','$2a$10$c.slEVgf5b/3BnAWlLb/vOu7VVSOKJ4ljwMe9xzlx9IhKnvAsJYM6');

-- Welcome Memo (Pinned)
INSERT INTO memo (id,uid,creator_id,content,visibility,pinned,payload) VALUES(1,'welcome2memos001',1,replace('# Welcome to Memos!\\n\\nA privacy-first, lightweight note-taking service. Easily capture and share your great thoughts.\\n\\n## Key Features\\n\\n- **Privacy First**: Your data stays with you\\n- **Markdown Support**: Full CommonMark + GFM syntax\\n- **Quick Capture**: Jot down thoughts instantly\\n- **Organize with Tags**: Use #tags to categorize\\n- **Open Source**: Free and open source software\\n\\n---\\n\\nStart exploring the demo memos below to see what you can do! #welcome #getting-started','\\n',char(10)),'PUBLIC',1,'{"tags":["welcome","getting-started"],"property":{"hasLink":false}}');

-- Travel Bucket List Demo
INSERT INTO memo (id,uid,creator_id,content,visibility,payload) VALUES(2,'travelbucket01',1,replace('## 🌍 My Travel Bucket List #travel #bucketlist\\n\\n### Places I''ve Been\\n- [x] Paris, France - Amazing food and art!\\n- [x] Shanghai, China - Modern skyline meets ancient temples\\n- [x] Grand Canyon, USA - Breathtaking views\\n- [x] Barcelona, Spain - Gaudí''s architecture is incredible\\n\\n### Dream Destinations\\n- [ ] Northern Lights in Iceland\\n- [ ] Safari in Tanzania\\n- [ ] Great Barrier Reef, Australia\\n- [ ] Machu Picchu, Peru\\n- [ ] Santorini, Greece\\n- [ ] New Zealand road trip\\n\\n### 2025 Plans\\n- [ ] Book tickets to Iceland for winter\\n- [ ] Research best time to visit Patagonia\\n- [ ] Save up for Australia trip','\\n',char(10)),'PUBLIC','{"tags":["travel","bucketlist"],"property":{"hasTaskList":true,"hasIncompleteTasks":true}}');

-- Recipe Demo
INSERT INTO memo (id,uid,creator_id,content,visibility,payload) VALUES(3,'cookierecipe01',1,replace('## 🍪 The Perfect Chocolate Chip Cookies #cooking #recipe\\n\\nMy grandma''s secret recipe that never fails!\\n\\n### Ingredients\\n\\n```\\n2¼ cups all-purpose flour\\n1 tsp baking soda\\n1 tsp salt\\n1 cup (2 sticks) butter, softened\\n¾ cup granulated sugar\\n¾ cup packed brown sugar\\n2 large eggs\\n2 tsp vanilla extract\\n2 cups chocolate chips\\n```\\n\\n### Instructions\\n\\n1. Preheat oven to 375°F (190°C)\\n2. Mix flour, baking soda, and salt in a bowl\\n3. Beat butter and sugars until creamy\\n4. Add eggs and vanilla, beat well\\n5. Gradually blend in flour mixture\\n6. Stir in chocolate chips\\n7. Drop rounded tablespoons onto ungreased baking sheets\\n8. Bake 9-11 minutes or until golden brown\\n9. Cool on baking sheet for 2 minutes\\n\\n**Pro tip**: Slightly underbake them for chewier cookies! 😋','\\n',char(10)),'PUBLIC','{"tags":["cooking","recipe"],"property":{"hasCode":true}}');

-- Movie Watchlist with Table
INSERT INTO memo (id,uid,creator_id,content,visibility,payload) VALUES(4,'moviewatch001',1,replace('## 🎬 February Movie Marathon #movies #watchlist\\n\\nCatching up on films I''ve been meaning to watch!\\n\\n### This Month''s Queue\\n\\n| Movie | Genre | Status | Rating |\\n|-------|-------|--------|--------|\\n| The Grand Budapest Hotel | Comedy/Drama | ✅ Watched | ⭐⭐⭐⭐⭐ |\\n| Inception | Sci-Fi | ✅ Watched | ⭐⭐⭐⭐⭐ |\\n| Spirited Away | Animation | ✅ Watched | ⭐⭐⭐⭐⭐ |\\n| Dune: Part Two | Sci-Fi | 📅 This weekend | - |\\n| Barbie | Comedy | 📋 Queued | - |\\n| Oppenheimer | Biography | 📋 Queued | - |\\n\\n### Notes\\n- Grand Budapest Hotel: Wes Anderson''s visual style is *chef''s kiss*\\n- Inception: Need to watch again to catch all the details\\n- Spirited Away: Studio Ghibli never disappoints!\\n\\n---\\n\\n**Next month**: Planning a Miyazaki marathon! 🎨','\\n',char(10)),'PUBLIC','{"tags":["movies","watchlist"],"property":{"hasLink":false}}');

-- Quick Thought
INSERT INTO memo (id,uid,creator_id,content,visibility,payload) VALUES(5,'randomthought01',1,'🤔 **Random thought**: If you could have dinner with any three people (living or historical), who would you choose? I''d go with Carl Sagan, Marie Curie, and Robin Williams. #thoughts #questions','PUBLIC','{"tags":["thoughts","questions"],"property":{"hasLink":false}}');

-- Reading List Demo
INSERT INTO memo (id,uid,creator_id,content,visibility,payload) VALUES(6,'readinglist001',1,replace('## 📚 2025 Reading Challenge #books #reading\\n\\n**Goal**: Read 24 books this year (2 per month)\\n**Progress**: 3/24 books completed\\n\\n### Currently Reading\\n- [ ] *The Midnight Library* by Matt Haig (45% done)\\n- [ ] *Sapiens* by Yuval Noah Harari (just started)\\n\\n### Finished This Year\\n- [x] *Project Hail Mary* by Andy Weir - ⭐⭐⭐⭐⭐\\n- [x] *Atomic Habits* by James Clear - ⭐⭐⭐⭐\\n- [x] *The House in the Cerulean Sea* by TJ Klune - ⭐⭐⭐⭐⭐\\n\\n### Up Next\\n- [ ] *Tomorrow, and Tomorrow, and Tomorrow*\\n- [ ] *The Martian* (re-read)\\n- [ ] *How to Take Smart Notes*','\\n',char(10)),'PUBLIC','{"tags":["books","reading"],"property":{"hasTaskList":true,"hasIncompleteTasks":true}}');

-- Fun Fact
INSERT INTO memo (id,uid,creator_id,content,visibility,payload) VALUES(7,'funfact000001',1,'🦦 **Fun fact I learned today**: Otters have a favorite rock that they keep in a pocket of skin under their forearm! They use it to crack open shellfish. Some otters keep the same rock their whole lives. #todayilearned #nature','PUBLIC','{"tags":["todayilearned","nature"],"property":{"hasLink":false}}');

-- Sponsor Message (Pinned)
INSERT INTO memo (id,uid,creator_id,content,visibility,pinned,payload) VALUES(8,'sponsor0000001',1,replace('**[Warp](https://go.warp.dev/memos)**: A modern terminal reimagined to work with AI, helping developers build faster and more efficiently.\\n\\n[![Warp](https://raw.githubusercontent.com/warpdotdev/brand-assets/main/Github/Sponsor/Warp-Github-LG-02.png)](https://go.warp.dev/memos)\\n\\n#sponsor','\\n',char(10)),'PUBLIC',1,'{"tags":["sponsor"],"property":{"hasLink":true}}');

-- Memo Relations
INSERT INTO memo_relation VALUES(3,1,'REFERENCE');

-- Reactions (using memo UIDs, not numeric IDs)
INSERT INTO reaction (id,creator_id,content_id,reaction_type) VALUES(1,1,'memos/welcome2memos001','🎉');
INSERT INTO reaction (id,creator_id,content_id,reaction_type) VALUES(2,1,'memos/welcome2memos001','👍');
INSERT INTO reaction (id,creator_id,content_id,reaction_type) VALUES(3,1,'memos/funfact000001','🦦');
INSERT INTO reaction (id,creator_id,content_id,reaction_type) VALUES(4,1,'memos/sponsor0000001','🚀');
INSERT INTO reaction (id,creator_id,content_id,reaction_type) VALUES(5,1,'memos/sponsor0000001','👍');

-- System Settings
INSERT INTO system_setting VALUES ('MEMO_RELATED', '{"contentLengthLimit":8192,"enableAutoCompact":true,"enableComment":true,"enableLocation":true,"defaultVisibility":"PUBLIC","reactions":["👍","💛","🔥","👏","😂","👌","🚀","👀","🤔","🤡","❓","+1","🎉","💡","✅"]}', '');
