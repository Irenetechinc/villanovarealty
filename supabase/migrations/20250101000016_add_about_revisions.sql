CREATE TABLE IF NOT EXISTS about_section_revisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id UUID REFERENCES about_sections(id) ON DELETE CASCADE,
  content_snapshot JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE about_section_revisions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage revisions" ON about_section_revisions;
CREATE POLICY "Admins can manage revisions" ON about_section_revisions
  FOR ALL USING (
    (auth.jwt() -> 'user_metadata' ->> 'role')::text = 'admin'
  );
