INSERT INTO archived_messages SELECT * FROM posts WHERE create_at < NOW() - INTERVAL '2 years';
DELETE FROM posts WHERE create_at < NOW() - INTERVAL '2 years';