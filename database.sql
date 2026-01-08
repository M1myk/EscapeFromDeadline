-- Baza danych dla Escape Room: Release Day
-- Uruchom ten skrypt w MySQL, aby utworzyć bazę danych i tabelę

CREATE DATABASE IF NOT EXISTS escape_room_game CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE escape_room_game;

CREATE TABLE IF NOT EXISTS scores (
  id INT AUTO_INCREMENT PRIMARY KEY,
  team_name VARCHAR(255) NOT NULL,
  score INT NOT NULL,
  time_seconds INT NOT NULL,
  mode VARCHAR(50) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_score (score DESC),
  INDEX idx_time (time_seconds ASC),
  INDEX idx_created (created_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Przykładowe zapytania:
-- SELECT * FROM scores ORDER BY score DESC LIMIT 10;
-- SELECT * FROM scores ORDER BY time_seconds ASC LIMIT 10;
-- SELECT * FROM scores ORDER BY created_at DESC LIMIT 10;

