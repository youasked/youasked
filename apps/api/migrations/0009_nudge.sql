-- The occasional in-app prompt ("Got an idea for <App>?"). JSON settings, NULL means off:
-- {"everyDays":7,"activeSeconds":30,"skipVisits":1,"message":null,"position":"bottom"}
ALTER TABLE apps ADD COLUMN nudge TEXT;
