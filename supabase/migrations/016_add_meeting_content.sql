-- Add content field to saif_meetings for shared note-taking document
ALTER TABLE saif_meetings
ADD COLUMN content TEXT DEFAULT '';

-- Add index for faster content updates
CREATE INDEX idx_saif_meetings_content ON saif_meetings(id) WHERE content IS NOT NULL;
