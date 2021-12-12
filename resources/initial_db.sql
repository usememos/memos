DROP TABLE IF EXISTS `queries`;
CREATE TABLE `queries`  (
  `id` TEXT NOT NULL PRIMARY KEY,
  `user_id` TEXT NOT NULL,
  `title` TEXT NOT NULL,
  `querystring` TEXT NOT NULL,
  `created_at` TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `pinned_at` TEXT DEFAULT '',
  FOREIGN KEY(`user_id`) REFERENCES `users`(`id`)
);

DROP TABLE IF EXISTS `memos`;
CREATE TABLE `memos`  (
  `id` TEXT NOT NULL PRIMARY KEY,
  `content` TEXT NOT NULL,
  `user_id` TEXT NOT NULL,
  `created_at` TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `deleted_at` TEXT DEFAULT '',
  FOREIGN KEY(`user_id`) REFERENCES `users`(`id`)
);

DROP TABLE IF EXISTS `users`;
CREATE TABLE `users` (
	`id` TEXT NOT NULL PRIMARY KEY,
	`username` TEXT NOT NULL,
	`password` TEXT NOT NULL,
	`github_name` TEXT DEFAULT '',
  `wx_open_id` TEXT DEFAULT '',
	`created_at` TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(`username`, `github_name`, `wx_open_id`)
);

INSERT INTO `users`
  (`id`, `username`, `password`)
VALUES
  ('1', 'guest', '123456');

INSERT INTO `memos`
  (`id`, `content`, `user_id`)
VALUES
  ('1', '👋 Welcome to memos', '1');
