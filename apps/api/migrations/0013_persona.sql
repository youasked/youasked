-- Who the widget's messages come from: the developer's own photo, name and words, so the corner prompt
-- reads like a text from a person and the chat opens with their welcome note. JSON, NULL means not set:
-- {"name":"Aden","role":"Made Keep This Day","avatar":"https://api.youasked.dev/v1/uploads/upl_…","intro":"…"}
ALTER TABLE apps ADD COLUMN persona TEXT;
