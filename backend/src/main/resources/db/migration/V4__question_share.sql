-- 문제 하나 공유하기: 어떤 문제가 공유되고, 받은 사람이 얼마나 풀었는지 문제별로 센다
ALTER TABLE events ADD COLUMN qid VARCHAR(16);
CREATE INDEX idx_events_qid ON events (qid);
