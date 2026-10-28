ALTER TABLE doc_sites ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'manual';
UPDATE doc_sites s SET kind = 'wiki' WHERE s.kind = 'manual' AND EXISTS (SELECT 1 FROM docs d WHERE d.site_id = s.id AND d.doc_type = 'wiki' AND d.source = 'generated');
UPDATE doc_sites s SET status = 'archived', updated_at = NOW() WHERE s.kind = 'wiki' AND s.status <> 'archived' AND s.app_id IS NOT NULL AND EXISTS (SELECT 1 FROM doc_sites o WHERE o.app_id = s.app_id AND o.kind = 'wiki' AND o.status <> 'archived' AND (COALESCE(o.updated_at, o.created_at), o.created_at, o.id) > (COALESCE(s.updated_at, s.created_at), s.created_at, s.id));
CREATE UNIQUE INDEX IF NOT EXISTS doc_sites_wiki_app_unique ON doc_sites (app_id) WHERE kind = 'wiki' AND status <> 'archived' AND app_id IS NOT NULL;
