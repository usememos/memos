-- Demo User (Admin) — password: changeme (MUST be changed after seeding)
INSERT INTO user (id,username,role,nickname,password_hash) VALUES(1,'demo','ADMIN','Demo User','$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy');

-- Alice (User) — password: changeme (MUST be changed after seeding)
INSERT INTO user (id,username,role,nickname,description,password_hash) VALUES(2,'alice','USER','Alice','Developer & avid reader 📚','$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy');

-- 1. Welcome Memo (Pinned)
INSERT INTO memo (id,uid,creator_id,content,visibility,pinned,payload) VALUES(1,'welcome2memos001',1,replace('# Welcome to Memos!\n\nAn open-source, self-hosted note-taking tool. Capture thoughts instantly. Own them completely.\n\n## Key Features\n\n- **Write anything**: Quick notes, long-form writing, technical docs\n- **Markdown**: Full CommonMark + GFM syntax\n- **Task Lists**: Track to-dos inline with `- [ ]` syntax\n- **Tags**: Use #hashtags to organize your memos\n- **Attachments**: Images, videos, documents — drag & drop\n- **Location**: Geotag memos to remember where ideas struck\n- **Reactions & Comments**: Engage with any memo\n- **Relations**: Connect and reference related memos\n\n---\n\nExplore the demo memos below to see what''s possible! #welcome #getting-started','\n',char(10)),'PUBLIC',1,'{"tags":["welcome","getting-started"],"property":{"hasLink":false}}');
