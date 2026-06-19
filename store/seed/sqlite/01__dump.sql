-- Demo User (Admin) — password: demo
INSERT INTO user (id,username,role,nickname,password_hash) VALUES(1,'demo','ADMIN','Demo User','$2a$10$c.slEVgf5b/3BnAWlLb/vOu7VVSOKJ4ljwMe9xzlx9IhKnvAsJYM6');

-- Alice (User) — password: demo
INSERT INTO user (id,username,role,nickname,description,password_hash) VALUES(2,'alice','USER','Alice','Developer & avid reader 📚','$2a$10$c.slEVgf5b/3BnAWlLb/vOu7VVSOKJ4ljwMe9xzlx9IhKnvAsJYM6');

-- 1. Welcome Memo (Pinned) — newest created_ts so it leads the pinned section
INSERT INTO memo (id,uid,creator_id,created_ts,updated_ts,content,visibility,pinned,payload) VALUES(1,'welcome2memos001',1,strftime('%s','now','-2 days'),strftime('%s','now','-2 days'),replace('# Welcome to Memos 👋\n\nAn open-source, self-hosted note-taking tool for people who think in fragments. Capture quickly, organize lightly, own everything.\n\n> Most apps treat notes like documents. Memos treats them like thoughts — short, timestamped, searchable.\n\n## Try it right now\n\n- [x] Open this memo\n- [ ] React with 🎉 below\n- [ ] Scroll the timeline to see what others have written\n- [ ] Write your own first memo\n\n## What you can do here\n\n| Feature | Example |\n|---------|---------|\n| **Markdown** | Headings, **bold**, *italic*, `code`, ~~strikethrough~~ |\n| **Tags** | Type `#anything` and it becomes a filter |\n| **Task lists** | `- [ ]` checkboxes that toggle inline |\n| **Code blocks** | Fenced blocks with syntax highlighting |\n| **Tables** | Pipes and dashes — yes, this one |\n| **Attachments** | Drag images, videos, or files right in |\n| **Location** | Geotag a memo to where you wrote it |\n| **Relations** | Link memos together as references or replies |\n\n## Self-host in one command\n\n```bash\ndocker run -d -p 5230:5230 -v ~/.memos:/var/opt/memos neosmemo/memos:stable\n```\n\nThen open `http://localhost:5230` and start writing.\n\n---\n\nScroll the timeline to see each feature used in real memos. #welcome #getting-started','\n',char(10)),'PUBLIC',1,'{"tags":["welcome","getting-started"],"property":{"hasLink":false,"hasCode":true,"hasTaskList":true,"hasIncompleteTasks":true}}');

-- 2. Reading Note — book quote + personal reflection (Alice)
INSERT INTO memo (id,uid,creator_id,created_ts,updated_ts,content,visibility,payload) VALUES(2,'readingnote0001',2,strftime('%s','now','-22 days'),strftime('%s','now','-22 days'),replace('## 📖 Reading: Deep Work #books #reading\n\nStarted Cal Newport''s *Deep Work* this week. This passage stopped me:\n\n> "Human beings, it seems, are at their best when immersed deeply in something challenging."\n\nThat''s the whole pitch in one sentence. The rest of the book is just evidence for it.\n\nTrying an experiment for the next two weeks: no Slack or email until 11am. See what shifts when the morning is mine.','\n',char(10)),'PUBLIC','{"tags":["books","reading"],"property":{"hasLink":false},"location":{"placeholder":"Sightglass Coffee, San Francisco, California, United States","latitude":37.7726,"longitude":-122.4099}}');

-- 3. Git Cheat Sheet — practical reference card with code blocks
INSERT INTO memo (id,uid,creator_id,created_ts,updated_ts,content,visibility,payload) VALUES(3,'gitcheatsheet01',1,strftime('%s','now','-17 days'),strftime('%s','now','-17 days'),replace('## ⚡ Git Commands I Keep Forgetting #dev #cheatsheet\n\nPinning this so I stop googling the same things every week.\n\n```bash\n# Show the last commit in detail\ngit show --stat HEAD\n\n# Undo the last commit, keep changes staged\ngit reset --soft HEAD~1\n\n# Stash including untracked files\ngit stash push -u -m "wip: before refactor"\n\n# Find which commit introduced a string\ngit log -S "function_name" --source --all\n```\n\nThe `-S` one is gold for archaeology — way better than scrolling blame.','\n',char(10)),'PUBLIC','{"tags":["dev","cheatsheet"],"property":{"hasLink":false,"hasCode":true}}');

-- 4. Travel Bucket List (has location: Paris)
INSERT INTO memo (id,uid,creator_id,created_ts,updated_ts,content,visibility,payload) VALUES(4,'travelbucket01',1,strftime('%s','now','-13 days'),strftime('%s','now','-13 days'),replace('## 🌍 My Travel Bucket List #travel #bucketlist\n\n> Writing this from a tiny café near the Seine. Will keep updating after each trip. 📍\n\n### Places I''ve Been\n- [x] Paris, France — The croissants ruined every croissant after\n- [x] Shanghai, China — Modern skyline next to thousand-year-old temples, somehow it all works\n- [x] Grand Canyon, USA — Photos do not do this justice\n- [x] Barcelona, Spain — Gaudí''s architecture looks like it was built by a slightly chaotic deity\n\n### Dream Destinations\n- [ ] Northern Lights in Iceland — booking this for winter, *finally*\n- [ ] Safari in Tanzania\n- [ ] Great Barrier Reef, Australia — before it gets worse\n- [ ] Machu Picchu, Peru\n- [ ] Santorini, Greece\n- [ ] New Zealand road trip — south island, two weeks minimum\n\n### 2026 Plans\n- [ ] Book tickets to Iceland for winter\n- [ ] Research best time to visit Patagonia\n- [ ] Save up for Australia trip','\n',char(10)),'PUBLIC','{"tags":["travel","bucketlist"],"property":{"hasTaskList":true,"hasIncompleteTasks":true},"location":{"placeholder":"Paris, Île-de-France, France","latitude":48.8566,"longitude":2.3522}}');

-- 5. Movie Watchlist — posted by Alice
INSERT INTO memo (id,uid,creator_id,created_ts,updated_ts,content,visibility,payload) VALUES(5,'moviewatch00001',2,strftime('%s','now','-9 days'),strftime('%s','now','-9 days'),replace('## 🎬 Movie Marathon #movies #watchlist\n\nCatching up on films I''ve been meaning to watch for, uh, years.\n\n### This Month''s Queue\n\n| Movie | Genre | Status | Rating |\n|-------|-------|--------|--------|\n| The Grand Budapest Hotel | Comedy/Drama | ✅ Watched | ⭐⭐⭐⭐⭐ |\n| Inception | Sci-Fi | ✅ Watched | ⭐⭐⭐⭐⭐ |\n| Spirited Away | Animation | ✅ Watched | ⭐⭐⭐⭐⭐ |\n| Everything Everywhere All at Once | Sci-Fi/Drama | ✅ Watched | ⭐⭐⭐⭐⭐ |\n| Dune: Part Two | Sci-Fi | 📅 This weekend | — |\n| Oppenheimer | Biography | 📋 Queued | — |\n\n### Notes\n- **Grand Budapest Hotel**: Wes Anderson''s visual style is *chef''s kiss* ✨ Every frame could be a postcard.\n- **Inception**: Need to watch again to catch all the details. The hallway scene still holds up.\n- **Spirited Away**: Studio Ghibli never disappoints. Cried twice. No regrets.\n- **Everything Everywhere**: Watched it cold, did not expect the bagel.\n\n---\n\n**Next month**: Full Miyazaki marathon 🎨 Taking suggestions for which one to start with.','\n',char(10)),'PUBLIC','{"tags":["movies","watchlist"],"property":{"hasLink":false}}');

-- 6. Comment on Welcome (by Alice)
INSERT INTO memo (id,uid,creator_id,created_ts,updated_ts,content,visibility,payload) VALUES(6,'welcomecmt00001',2,strftime('%s','now','-1 days'),strftime('%s','now','-1 days'),'Just set up my own instance — this is exactly the note-taking app I''ve been looking for! The interface is so clean 🙌','PUBLIC','{"property":{"hasLink":false}}');

-- 7. Comment on Git Cheat Sheet (by Alice)
INSERT INTO memo (id,uid,creator_id,created_ts,updated_ts,content,visibility,payload) VALUES(7,'gitcheatcmt0001',2,strftime('%s','now','-17 days','+5 hours'),strftime('%s','now','-17 days','+5 hours'),'Saving the `git log -S` one — I''ve been doing this with grep through git blame outputs for years. So much cleaner. 🔥','PUBLIC','{"property":{"hasLink":false}}');

-- 8. Reply on Git Cheat Sheet (by Demo)
INSERT INTO memo (id,uid,creator_id,created_ts,updated_ts,content,visibility,payload) VALUES(8,'gitcheatcmt0002',1,strftime('%s','now','-17 days','+6 hours'),strftime('%s','now','-17 days','+6 hours'),'Yeah `-S` is criminally underused. Also try `git log -p path/to/file` when you need the *content* changes for one file — same archaeology vibe.','PUBLIC','{"property":{"hasLink":false}}');

-- 9. Sponsor Memo (Pinned) — sits below Welcome in the pinned section (older created_ts)
INSERT INTO memo (id,uid,creator_id,created_ts,updated_ts,content,visibility,pinned,payload) VALUES(9,'sponsor0000001',1,strftime('%s','now','-5 days'),strftime('%s','now','-5 days'),replace('Memos is free and open source, kept independent by its sponsors — no ads, no telemetry, no paywalls. 🙏 If you build with Memos, please consider supporting them in return.\n\n## ⭐ Sponsors\n\n<a href="https://coderabbit.link/usememos" target="_blank" rel="noopener"><img src="https://victorious-bubble-f69a016683.media.strapiapp.com/Orange_Typemark_43bf516c9d.svg" alt="CodeRabbit" height="44" /></a>\n\nCut code review time & bugs in half, instantly. [coderabbit.link/usememos →](https://coderabbit.link/usememos)\n\n---\n\n**SSD Nodes** — Affordable VPS hosting for self-hosters. [ssdnodes.com →](https://ssdnodes.com/?utm_source=memos&utm_medium=sponsor)\n\n---\n\nWant to see your company here? Reach out via [GitHub Sponsors](https://github.com/sponsors/usememos).\n\n#sponsors','\n',char(10)),'PUBLIC',1,'{"tags":["sponsors"],"property":{"hasLink":true}}');

-- 10. Scratchpad Promo (not pinned) — keeps the pinned section to Welcome + Sponsor, less ad-heavy
INSERT INTO memo (id,uid,creator_id,created_ts,updated_ts,content,visibility,pinned,payload) VALUES(10,'scratchpad0001',1,strftime('%s','now','-8 days'),strftime('%s','now','-8 days'),replace('## 🧩 Try Memos Scratchpad\n\nA lightweight visual canvas for quick thoughts, links, images, files, and small cards before they become polished notes.\n\n[Open Scratchpad →](https://usememos.com/scratchpad)\n\n| Need | Scratchpad helps you |\n|------|----------------------|\n| Capture fast | Double-click to add notes |\n| Arrange freely | Drag cards around |\n| Add context | Attach files, links, and images |\n| Move around | Zoom and pan without setup |\n\n### Local-first\n\nYour Scratchpad cards stay in your browser. Memos does not access, sync, or store them.','\n',char(10)),'PUBLIC',0,'{"tags":["scratchpad"],"property":{"hasLink":true}}');

-- Memo Relations
INSERT INTO memo_relation VALUES(6,1,'COMMENT');     -- Alice comments on Welcome
INSERT INTO memo_relation VALUES(7,3,'COMMENT');     -- Alice comments on Git Cheat Sheet
INSERT INTO memo_relation VALUES(8,3,'COMMENT');     -- Demo replies on Git Cheat Sheet

-- Reactions
INSERT INTO reaction (id,creator_id,content_id,reaction_type) VALUES(1,1,'memos/welcome2memos001','🎉');
INSERT INTO reaction (id,creator_id,content_id,reaction_type) VALUES(2,2,'memos/welcome2memos001','👍');
INSERT INTO reaction (id,creator_id,content_id,reaction_type) VALUES(3,1,'memos/welcome2memos001','👏');
INSERT INTO reaction (id,creator_id,content_id,reaction_type) VALUES(4,2,'memos/readingnote0001','💛');
INSERT INTO reaction (id,creator_id,content_id,reaction_type) VALUES(5,1,'memos/readingnote0001','💡');
INSERT INTO reaction (id,creator_id,content_id,reaction_type) VALUES(6,2,'memos/readingnote0001','👀');
INSERT INTO reaction (id,creator_id,content_id,reaction_type) VALUES(7,1,'memos/sponsor0000001','🚀');
INSERT INTO reaction (id,creator_id,content_id,reaction_type) VALUES(8,2,'memos/sponsor0000001','👍');
INSERT INTO reaction (id,creator_id,content_id,reaction_type) VALUES(9,2,'memos/gitcheatsheet01','🔥');
INSERT INTO reaction (id,creator_id,content_id,reaction_type) VALUES(10,2,'memos/travelbucket01','👀');
INSERT INTO reaction (id,creator_id,content_id,reaction_type) VALUES(11,1,'memos/scratchpad0001','💡');
INSERT INTO reaction (id,creator_id,content_id,reaction_type) VALUES(12,2,'memos/scratchpad0001','🚀');

-- Demo Access Token — log in programmatically with `Authorization: Bearer memos_pat_demo`.
-- Only the SHA-256 hash is stored; the prefix `memos_pat_` is the sole format requirement,
-- so a readable demo value works just as well as a random one.
INSERT INTO user_setting (user_id,key,value) VALUES(1,'PERSONAL_ACCESS_TOKENS','{"tokens":[{"tokenId":"demo-access-token","tokenHash":"7631cdaa5b56a39371dab01d5d186fd73f05602cc8ad29bf72ffef3713badd9d","description":"Demo access token","createdAt":"2024-01-01T00:00:00Z"}]}');

-- System Settings
INSERT INTO system_setting VALUES ('MEMO_RELATED', '{"contentLengthLimit":8192,"enableAutoCompact":true,"enableComment":true,"enableLocation":true,"defaultVisibility":"PUBLIC","reactions":["👍","💛","🔥","👏","😂","👌","🚀","👀","🤔","🤡","❓","+1","🎉","💡","✅"]}', '');
