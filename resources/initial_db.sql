DROP TABLE IF EXISTS `memos`;
DROP TABLE IF EXISTS `queries`;
DROP TABLE IF EXISTS `users`;

CREATE TABLE `users` (
  `id` TEXT NOT NULL PRIMARY KEY,
  `username` TEXT NOT NULL,
  `password` TEXT NOT NULL,
  `github_name` TEXT NOT NULL DEFAULT '',
  `created_at` TEXT NOT NULL DEFAULT (DATETIME('now', 'localtime')),
  `updated_at` TEXT NOT NULL DEFAULT (DATETIME('now', 'localtime')),
  UNIQUE(`username`, `github_name`)
);

CREATE TABLE `queries`  (
  `id` TEXT NOT NULL PRIMARY KEY,
  `user_id` TEXT NOT NULL,
  `title` TEXT NOT NULL,
  `querystring` TEXT NOT NULL,
  `created_at` TEXT NOT NULL DEFAULT (DATETIME('now', 'localtime')),
  `updated_at` TEXT NOT NULL DEFAULT (DATETIME('now', 'localtime')),
  `pinned_at` TEXT NOT NULL DEFAULT '',
  FOREIGN KEY(`user_id`) REFERENCES `users`(`id`)
);

CREATE TABLE `memos`  (
  `id` TEXT NOT NULL PRIMARY KEY,
  `content` TEXT NOT NULL,
  `user_id` TEXT NOT NULL,
  `created_at` TEXT NOT NULL DEFAULT (DATETIME('now', 'localtime')),
  `updated_at` TEXT NOT NULL DEFAULT (DATETIME('now', 'localtime')),
  `deleted_at` TEXT NOT NULL DEFAULT '',
  FOREIGN KEY(`user_id`) REFERENCES `users`(`id`)
);

INSERT INTO `users`
  (`id`, `username`, `password`)
VALUES
  ('1', 'guest', '123456'),
  ('2', 'test', '123456');

INSERT INTO `memos`
  (`id`, `content`, `user_id`)
VALUES
  ('1', '👋 Welcome to memos', '1'),
  ('2', '👋 Welcome to memos', '2');
