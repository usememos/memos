-- Demo User
INSERT INTO user (id,username,role,nickname,password_hash) VALUES(1,'demo','HOST','Demo User','$2a$10$c.slEVgf5b/3BnAWlLb/vOu7VVSOKJ4ljwMe9xzlx9IhKnvAsJYM6');

-- Welcome Memo (Pinned)
INSERT INTO memo (id,uid,creator_id,content,visibility,pinned,payload) VALUES(1,'welcome2memos001',1,replace('# Welcome to Memos!\n\nA privacy-first, lightweight note-taking service. Easily capture and share your great thoughts.\n\n## Key Features\n\n- **Privacy First**: Your data stays with you\n- **Markdown Support**: Full CommonMark + GFM syntax\n- **Quick Capture**: Jot down thoughts instantly\n- **Organize with Tags**: Use #tags to categorize\n- **Open Source**: Free and open source software\n\n---\n\nStart exploring the demo memos below to see what you can do! #welcome #getting-started','\n',char(10)),'PUBLIC',1,'{"tags":["welcome","getting-started"],"property":{"hasLink":false}}');

-- Task Management Demo
INSERT INTO memo (id,uid,creator_id,content,visibility,payload) VALUES(2,'taskdemo000001',1,replace('## My Weekly Tasks #todo/work\n\n### High Priority\n- [x] Review Q1 project proposals\n- [x] Prepare team meeting agenda\n- [ ] Submit budget report by Friday\n- [ ] Schedule 1:1s with team members\n\n### Development\n- [x] Fix critical bug in production\n- [ ] Write unit tests for new features\n- [ ] Update API documentation\n- [ ] Code review for PR #234\n\n### Personal\n- [x] Morning workout\n- [ ] Read "Clean Code" chapter 5\n- [ ] Call mom this weekend','\n',char(10)),'PUBLIC','{"tags":["todo/work"],"property":{"hasTaskList":true,"hasIncompleteTasks":true}}');

-- Code Snippet Demo
INSERT INTO memo (id,uid,creator_id,content,visibility,payload) VALUES(3,'codedemo000001',1,replace('## Quick Reference: Git Commands #dev/git\n\nSome frequently used Git commands I always forget:\n\n```bash\n# Undo last commit but keep changes\ngit reset --soft HEAD~1\n\n# Interactive rebase last 3 commits\ngit rebase -i HEAD~3\n\n# Cherry-pick a commit from another branch\ngit cherry-pick <commit-hash>\n\n# Create and switch to new branch\ngit checkout -b feature/new-branch\n```\n\n```javascript\n// Debounce function in JavaScript\nfunction debounce(func, wait) {\n  let timeout;\n  return function executedFunction(...args) {\n    const later = () => {\n      clearTimeout(timeout);\n      func(...args);\n    };\n    clearTimeout(timeout);\n    timeout = setTimeout(later, wait);\n  };\n}\n```','\n',char(10)),'PUBLIC','{"tags":["dev/git"],"property":{"hasCode":true}}');

-- Meeting Notes with Table
INSERT INTO memo (id,uid,creator_id,content,visibility,payload) VALUES(4,'meetingnote001',1,replace('## Team Standup - 2025-01-27 #meeting/standup\n\n**Attendees**: Alice, Bob, Carol, David\n**Duration**: 30 minutes\n\n### Progress Updates\n\n| Team Member | Yesterday | Today | Blockers |\n|------------|-----------|-------|----------|\n| Alice | Completed API integration | Start frontend work | None |\n| Bob | Fixed 3 bugs | Code review | Waiting for design |\n| Carol | Database migration | Performance testing | None |\n| David | Documentation | Deploy to staging | Server access |\n\n### Action Items\n- Alice: Begin implementing new UI components\n- Bob: Review Carol''s PR by EOD\n- David: Request server access from DevOps\n\n### Next Meeting\nTomorrow, same time','\n',char(10)),'PUBLIC','{"tags":["meeting/standup"],"property":{"hasLink":false}}');

-- Quick Idea
INSERT INTO memo (id,uid,creator_id,content,visibility,payload) VALUES(5,'idea00000001',1,'💡 **App Idea**: A browser extension that automatically summarizes long articles using AI. Could save so much reading time! #ideas/apps #ai','PUBLIC','{"tags":["ideas/apps","ai"],"property":{"hasLink":false}}');

-- Sponsor Message (Pinned)
INSERT INTO memo (id,uid,creator_id,content,visibility,pinned,payload) VALUES(6,'sponsor0000001',1,replace('**[Warp](https://go.warp.dev/memos)**: A modern terminal reimagined to work with AI, helping developers build faster and more efficiently.\n\n[![Warp](https://raw.githubusercontent.com/warpdotdev/brand-assets/main/Github/Sponsor/Warp-Github-LG-02.png)](https://go.warp.dev/memos)\n\n#sponsor','\n',char(10)),'PUBLIC',1,'{"tags":["sponsor"],"property":{"hasLink":true}}');

-- Memo Relations
INSERT INTO memo_relation VALUES(3,1,'REFERENCE');

-- Reactions (using memo UIDs, not numeric IDs)
INSERT INTO reaction (id,creator_id,content_id,reaction_type) VALUES(1,1,'memos/welcome2memos001','🎉');
INSERT INTO reaction (id,creator_id,content_id,reaction_type) VALUES(2,1,'memos/welcome2memos001','👍');
INSERT INTO reaction (id,creator_id,content_id,reaction_type) VALUES(3,1,'memos/taskdemo000001','✅');
INSERT INTO reaction (id,creator_id,content_id,reaction_type) VALUES(4,1,'memos/idea00000001','💡');
INSERT INTO reaction (id,creator_id,content_id,reaction_type) VALUES(5,1,'memos/sponsor0000001','🚀');

-- System Settings
INSERT INTO system_setting VALUES ('MEMO_RELATED', '{"contentLengthLimit":8192,"enableAutoCompact":true,"enableComment":true,"enableLocation":true,"defaultVisibility":"PUBLIC","reactions":["👍","💛","🔥","👏","😂","👌","🚀","👀","🤔","🤡","❓","+1","🎉","💡","✅"]}', '');
