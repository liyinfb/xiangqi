CREATE TABLE `savedGames` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`gameState` text NOT NULL,
	`moveCount` int NOT NULL DEFAULT 0,
	`difficulty` varchar(20) NOT NULL DEFAULT 'medium',
	`playerColor` varchar(10) NOT NULL DEFAULT 'red',
	`status` varchar(20) NOT NULL DEFAULT 'playing',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `savedGames_id` PRIMARY KEY(`id`)
);
