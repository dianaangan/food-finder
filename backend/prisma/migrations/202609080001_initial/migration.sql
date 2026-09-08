CREATE TABLE `DemoUser` (
  `id` VARCHAR(32) NOT NULL,
  `stripeCustomerId` VARCHAR(255) NULL,
  `stripeSubscriptionId` VARCHAR(255) NULL,
  `subscriptionStatus` VARCHAR(32) NOT NULL DEFAULT 'none',
  `checkoutSessionId` VARCHAR(255) NULL,
  `checkoutAttempt` INTEGER NOT NULL DEFAULT 0,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `DemoUser_stripeCustomerId_key` (`stripeCustomerId`),
  UNIQUE INDEX `DemoUser_stripeSubscriptionId_key` (`stripeSubscriptionId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE TABLE `RecentSearch` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `userId` VARCHAR(32) NOT NULL,
  `term` VARCHAR(120) NOT NULL,
  `language` VARCHAR(2) NOT NULL,
  `lastSearchedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `RecentSearch_userId_term_language_key` (`userId`, `term`, `language`),
  INDEX `RecentSearch_userId_lastSearchedAt_idx` (`userId`, `lastSearchedAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE `RecentSearch` ADD CONSTRAINT `RecentSearch_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `DemoUser`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
