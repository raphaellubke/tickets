-- Seed: Formulário Casal
-- Execute no Supabase SQL Editor

DO $$
DECLARE
    v_org_id uuid;
    v_form_id uuid;
    v_sizes jsonb := '["P","M","G","GG","EG","EGG","G1","G2","G3"]';
    v_sim_nao jsonb := '["Sim","Não"]';
    v_sacramentos jsonb := '["Batismo","1ª Eucaristia","Crisma","Casado(a) na Igreja"]';
    v_uniao jsonb := '["Casado no cartório","União Estável"]';
BEGIN
    -- Pega a primeira organização (ajuste se tiver mais de uma)
    SELECT id INTO v_org_id FROM organizations LIMIT 1;

    IF v_org_id IS NULL THEN
        RAISE EXCEPTION 'Nenhuma organização encontrada.';
    END IF;

    -- Cria o formulário
    INSERT INTO forms (name, description, status, organization_id, is_couple, has_shirts, has_tent_notice, is_active)
    VALUES ('Formulário Casal', NULL, 'active', v_org_id, false, true, false, true)
    RETURNING id INTO v_form_id;

    -- ─── SEÇÃO 1: DADOS PESSOAIS ───────────────────────────────────────────────
    INSERT INTO form_fields (form_id, label, type, required, options, order_index) VALUES
    (v_form_id, 'Dados Pessoais',                        'section_header', false, NULL,              0),

    -- ELA
    (v_form_id, 'Nome completo (Ela)',                   'text',     true,  NULL,              1),
    (v_form_id, 'Data de Nascimento (Ela)',               'text',     true,  NULL,              2),
    (v_form_id, 'Celular (Ela)',                          'text',     true,  NULL,              3),
    (v_form_id, 'Profissão (Ela)',                        'text',     false, NULL,              4),
    (v_form_id, 'Sacramentos que possui (Ela)',           'checkbox', false, v_sacramentos,     5),

    -- ELE
    (v_form_id, 'Nome completo (Ele)',                   'text',     true,  NULL,              6),
    (v_form_id, 'Data de Nascimento (Ele)',               'text',     true,  NULL,              7),
    (v_form_id, 'Celular (Ele)',                          'text',     true,  NULL,              8),
    (v_form_id, 'Profissão (Ele)',                        'text',     false, NULL,              9),
    (v_form_id, 'Sacramentos que possui (Ele)',           'checkbox', false, v_sacramentos,     10),

    -- Casal
    (v_form_id, 'União do Casal',                        'checkbox', false, v_uniao,           11),
    (v_form_id, 'Quanto tempo juntos?',                  'text',     false, NULL,              12),
    (v_form_id, 'Endereço Residencial',                  'text',     false, NULL,              13),
    (v_form_id, 'Número',                                'text',     false, NULL,              14),
    (v_form_id, 'Bairro',                                'text',     false, NULL,              15),
    (v_form_id, 'Cidade',                                'text',     false, NULL,              16);

    -- ─── SEÇÃO 2: CONTATO COM A FAMÍLIA ────────────────────────────────────────
    INSERT INTO form_fields (form_id, label, type, required, options, order_index) VALUES
    (v_form_id, 'Contato com a Família',                 'section_header', false, NULL,        17),
    (v_form_id, 'Contato 1 – Nome',                      'text',     true,  NULL,              18),
    (v_form_id, 'Contato 1 – Parentesco',                'text',     true,  NULL,              19),
    (v_form_id, 'Contato 1 – Celular',                   'text',     true,  NULL,              20),
    (v_form_id, 'Contato 2 – Nome',                      'text',     false, NULL,              21),
    (v_form_id, 'Contato 2 – Parentesco',                'text',     false, NULL,              22),
    (v_form_id, 'Contato 2 – Celular',                   'text',     false, NULL,              23),
    (v_form_id, 'Contato 3 – Nome',                      'text',     false, NULL,              24),
    (v_form_id, 'Contato 3 – Parentesco',                'text',     false, NULL,              25),
    (v_form_id, 'Contato 3 – Celular',                   'text',     false, NULL,              26);

    -- ─── SEÇÃO 3: VIDA NA IGREJA ────────────────────────────────────────────────
    INSERT INTO form_fields (form_id, label, type, required, options, order_index) VALUES
    (v_form_id, 'Vida na Igreja',                        'section_header', false, NULL,        27),
    (v_form_id, 'Paróquia que participa',                'text',     false, NULL,              28),
    (v_form_id, 'Participa de algum Movimento/Pastoral?','radio',    false, v_sim_nao,         29),
    (v_form_id, 'Se sim, qual Movimento/Pastoral?',      'text',     false, NULL,              30);

    -- ─── SEÇÃO 4: SAÚDE ─────────────────────────────────────────────────────────
    INSERT INTO form_fields (form_id, label, type, required, options, order_index) VALUES
    (v_form_id, 'Saúde',                                 'section_header', false, NULL,        31),

    -- ELA
    (v_form_id, 'Altura (Ela)',                          'text',     false, NULL,              32),
    (v_form_id, 'Peso (Ela)',                            'text',     false, NULL,              33),
    (v_form_id, 'Fumante? (Ela)',                        'radio',    false, v_sim_nao,         34),
    (v_form_id, 'Gestante?',                             'radio',    false, v_sim_nao,         35),
    (v_form_id, 'Toma algum remédio controlado? (Ela)',  'radio',    false, v_sim_nao,         36),
    (v_form_id, 'Se sim, qual(is)? (Ela)',               'text',     false, NULL,              37),
    (v_form_id, 'Restrição médica (Ela)',                'text',     false, NULL,              38),
    (v_form_id, 'Possui alguma alergia? (Ela)',          'radio',    false, v_sim_nao,         39),
    (v_form_id, 'Qual alergia? (Ela)',                   'text',     false, NULL,              40),

    -- ELE
    (v_form_id, 'Altura (Ele)',                          'text',     false, NULL,              41),
    (v_form_id, 'Peso (Ele)',                            'text',     false, NULL,              42),
    (v_form_id, 'Fumante? (Ele)',                        'radio',    false, v_sim_nao,         43),
    (v_form_id, 'Toma algum remédio controlado? (Ele)',  'radio',    false, v_sim_nao,         44),
    (v_form_id, 'Se sim, qual(is)? (Ele)',               'text',     false, NULL,              45),
    (v_form_id, 'Restrição médica (Ele)',                'text',     false, NULL,              46),
    (v_form_id, 'Possui alguma alergia? (Ele)',          'radio',    false, v_sim_nao,         47),
    (v_form_id, 'Qual alergia? (Ele)',                   'text',     false, NULL,              48);

    -- ─── SEÇÃO 5: OUTRAS INFORMAÇÕES ────────────────────────────────────────────
    INSERT INTO form_fields (form_id, label, type, required, options, order_index) VALUES
    (v_form_id, 'Outras Informações Importantes',        'section_header', false, NULL,        49),
    (v_form_id, 'Amigo/irmão/parente 1 – Nome',          'text',     false, NULL,              50),
    (v_form_id, 'Amigo/irmão/parente 1 – Parentesco',    'text',     false, NULL,              51),
    (v_form_id, 'Amigo/irmão/parente 2 – Nome',          'text',     false, NULL,              52),
    (v_form_id, 'Amigo/irmão/parente 2 – Parentesco',    'text',     false, NULL,              53),
    (v_form_id, 'Amigo/irmão/parente 3 – Nome',          'text',     false, NULL,              54),
    (v_form_id, 'Amigo/irmão/parente 3 – Parentesco',    'text',     false, NULL,              55);

    -- ─── SEÇÃO 6: TAMANHOS DAS CAMISETAS ────────────────────────────────────────
    INSERT INTO form_fields (form_id, label, type, required, options, order_index) VALUES
    (v_form_id, 'Tamanhos das Camisetas',                'section_header', false, NULL,        56),
    (v_form_id, 'Tamanho da Camisa (Ela)',               'shirt_size', true, v_sizes,          57),
    (v_form_id, 'Tamanho Especial (Ela)',                'text',     false, NULL,              58),
    (v_form_id, 'Tamanho da Camisa (Ele)',               'shirt_size', true, v_sizes,          59),
    (v_form_id, 'Tamanho Especial (Ele)',                'text',     false, NULL,              60);

    RAISE NOTICE 'Formulário Casal criado com sucesso! ID: %', v_form_id;
END $$;
