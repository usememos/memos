CREATE TABLE `users` (
	`id` TEXT NOT NULL PRIMARY KEY,
	`username` TEXT NOT NULL,
	`password` TEXT NOT NULL,
	`github_name` TEXT NULL DEFAULT '',
  `wx_open_id` TEXT NULL DEFAULT '',
	`created_at` TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE `memos`  (
  `id` TEXT NOT NULL PRIMARY KEY,
  `content` TEXT NOT NULL,
  `user_id` TEXT NOT NULL,
  `created_at` TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `deleted_at` TEXT,
  FOREIGN KEY(`user_id`) REFERENCES `users`(`id`)
);

CREATE TABLE `queries`  (
  `id` TEXT NOT NULL PRIMARY KEY,
  `user_id` TEXT NOT NULL,
  `title` TEXT NOT NULL,
  `querystring` TEXT NOT NULL,
  `created_at` TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `pinned_at` TEXT NULL,
  FOREIGN KEY(`user_id`) REFERENCES `users`(`id`)
);
