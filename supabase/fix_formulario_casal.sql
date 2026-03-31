-- Corrige o Formulário Casal para funcionar com is_couple=true
-- Execute APÓS rodar add_is_couple_field.sql

DO $$
DECLARE
    v_form_id uuid;
BEGIN
    SELECT id INTO v_form_id FROM forms WHERE name = 'Formulário Casal' LIMIT 1;
    IF v_form_id IS NULL THEN RAISE EXCEPTION 'Formulário Casal não encontrado'; END IF;

    -- ── 1. Garante is_couple = true ──────────────────────────────────────────
    UPDATE forms SET is_couple = true WHERE id = v_form_id;

    -- ── 2. Remove duplicatas "(Ele)" de campos pessoais/saúde/camisetas ─────
    DELETE FROM form_fields
    WHERE form_id = v_form_id
      AND label IN (
        'Nome completo (Ele)', 'Data de Nascimento (Ele)', 'Celular (Ele)',
        'Profissão (Ele)', 'Sacramentos que possui (Ele)',
        'Altura (Ele)', 'Peso (Ele)', 'Fumante? (Ele)',
        'Toma algum remédio controlado? (Ele)', 'Se sim, qual(is)? (Ele)',
        'Restrição médica (Ele)', 'Possui alguma alergia? (Ele)', 'Qual alergia? (Ele)',
        'Tamanho da Camisa (Ele)', 'Tamanho Especial (Ele)'
      );

    -- ── 3. Renomeia campos "(Ela)" → sem sufixo ──────────────────────────────
    UPDATE form_fields SET label = 'Nome completo'                    WHERE form_id = v_form_id AND label = 'Nome completo (Ela)';
    UPDATE form_fields SET label = 'Data de Nascimento'               WHERE form_id = v_form_id AND label = 'Data de Nascimento (Ela)';
    UPDATE form_fields SET label = 'Celular'                          WHERE form_id = v_form_id AND label = 'Celular (Ela)';
    UPDATE form_fields SET label = 'Profissão'                        WHERE form_id = v_form_id AND label = 'Profissão (Ela)';
    UPDATE form_fields SET label = 'Sacramentos que possui'           WHERE form_id = v_form_id AND label = 'Sacramentos que possui (Ela)';
    UPDATE form_fields SET label = 'Altura'                           WHERE form_id = v_form_id AND label = 'Altura (Ela)';
    UPDATE form_fields SET label = 'Peso'                             WHERE form_id = v_form_id AND label = 'Peso (Ela)';
    UPDATE form_fields SET label = 'Fumante?'                         WHERE form_id = v_form_id AND label = 'Fumante? (Ela)';
    UPDATE form_fields SET label = 'Toma algum remédio controlado?'   WHERE form_id = v_form_id AND label = 'Toma algum remédio controlado? (Ela)';
    UPDATE form_fields SET label = 'Se sim, qual(is)?'                WHERE form_id = v_form_id AND label = 'Se sim, qual(is)? (Ela)';
    UPDATE form_fields SET label = 'Restrição médica'                 WHERE form_id = v_form_id AND label = 'Restrição médica (Ela)';
    UPDATE form_fields SET label = 'Possui alguma alergia?'           WHERE form_id = v_form_id AND label = 'Possui alguma alergia? (Ela)';
    UPDATE form_fields SET label = 'Qual alergia?'                    WHERE form_id = v_form_id AND label = 'Qual alergia? (Ela)';
    UPDATE form_fields SET label = 'Tamanho da Camisa'                WHERE form_id = v_form_id AND label = 'Tamanho da Camisa (Ela)';
    UPDATE form_fields SET label = 'Tamanho Especial'                 WHERE form_id = v_form_id AND label = 'Tamanho Especial (Ela)';

    -- ── 4. Marca campos que devem aparecer como casal (ELA | ELE) ────────────
    UPDATE form_fields SET is_couple_field = true
    WHERE form_id = v_form_id
      AND label IN (
        'Nome completo', 'Data de Nascimento', 'Celular', 'Profissão',
        'Sacramentos que possui',
        'Altura', 'Peso', 'Fumante?',
        'Toma algum remédio controlado?', 'Se sim, qual(is)?',
        'Restrição médica', 'Possui alguma alergia?', 'Qual alergia?',
        'Tamanho da Camisa', 'Tamanho Especial'
      );

    -- ── 5. Marca campos que devem aparecer como campo único ──────────────────
    UPDATE form_fields SET is_couple_field = false
    WHERE form_id = v_form_id
      AND label IN (
        'União do Casal', 'Quanto tempo juntos?',
        'Endereço Residencial', 'Número', 'Bairro', 'Cidade',
        'Contato 1 – Nome', 'Contato 1 – Parentesco', 'Contato 1 – Celular',
        'Contato 2 – Nome', 'Contato 2 – Parentesco', 'Contato 2 – Celular',
        'Contato 3 – Nome', 'Contato 3 – Parentesco', 'Contato 3 – Celular',
        'Paróquia que participa',
        'Participa de algum Movimento/Pastoral?', 'Se sim, qual Movimento/Pastoral?',
        'Gestante?',
        'Amigo/irmão/parente 1 – Nome', 'Amigo/irmão/parente 1 – Parentesco',
        'Amigo/irmão/parente 2 – Nome', 'Amigo/irmão/parente 2 – Parentesco',
        'Amigo/irmão/parente 3 – Nome', 'Amigo/irmão/parente 3 – Parentesco'
      );

    -- ── 6. Renumera order_index em sequência ─────────────────────────────────
    WITH ordered AS (
        SELECT id, ROW_NUMBER() OVER (ORDER BY order_index) - 1 AS new_idx
        FROM form_fields WHERE form_id = v_form_id
    )
    UPDATE form_fields ff
    SET order_index = o.new_idx
    FROM ordered o WHERE ff.id = o.id;

    RAISE NOTICE 'Formulário Casal corrigido com sucesso!';
END $$;
