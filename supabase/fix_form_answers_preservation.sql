-- ─── Preserve form answers when fields are deleted/changed ────────────────────
-- 1. Add field_label column to store label at submission time
ALTER TABLE form_response_answers
    ADD COLUMN IF NOT EXISTS field_label text;

-- 2. Populate field_label for all existing answers that still have a linked field
UPDATE form_response_answers fra
SET field_label = ff.label
FROM form_fields ff
WHERE fra.field_id = ff.id
  AND fra.field_label IS NULL;

-- 3. Change field_id FK from ON DELETE CASCADE to ON DELETE SET NULL
--    (so deleting a field keeps the answer, just sets field_id to null)
ALTER TABLE form_response_answers
    ALTER COLUMN field_id DROP NOT NULL;

ALTER TABLE form_response_answers
    DROP CONSTRAINT IF EXISTS form_response_answers_field_id_fkey;

ALTER TABLE form_response_answers
    ADD CONSTRAINT form_response_answers_field_id_fkey
    FOREIGN KEY (field_id) REFERENCES public.form_fields(id) ON DELETE SET NULL;
