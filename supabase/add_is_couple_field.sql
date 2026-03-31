-- Adiciona coluna is_couple_field em form_fields
-- NULL ou TRUE = campo exibido como casal (Ela/Ele lado a lado)
-- FALSE = campo exibido como único, mesmo que o formulário seja is_couple=true
ALTER TABLE form_fields ADD COLUMN IF NOT EXISTS is_couple_field BOOLEAN DEFAULT NULL;
