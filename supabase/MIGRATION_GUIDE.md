# Como Aplicar a Migration do Sistema de Eventos

Este guia explica como aplicar a migration para habilitar o sistema de criação de eventos.

## Opção 1: Usando Supabase Dashboard (Recomendado)

1. Acesse o [Supabase Dashboard](https://app.supabase.com)
2. Selecione seu projeto
3. Vá para **SQL Editor** no menu lateral
4. Clique em **New Query**
5. Copie e cole o conteúdo do arquivo `migration_events_enhancement.sql`
6. Clique em **Run** para executar a migration

## Opção 2: Usando Supabase CLI

Se você tem o Supabase CLI instalado:

```bash
# Navegue até a pasta do projeto
cd "c:\Users\mateu\Desktop\Projetos V2\igreja-eventos"

# Execute a migration
supabase db push
```

## O que a Migration Faz

A migration adiciona:

1. **Novos campos na tabela `events`:**
   - `cover_image_url` - URL da imagem de capa
   - `ticket_types` - Tipos de ingressos (JSONB)
   - `max_attendees` - Capacidade máxima
   - `category` - Categoria do evento

2. **Políticas RLS:**
   - Membros podem criar eventos para sua organização
   - Membros podem atualizar eventos da organização
   - Admins/Owners podem deletar eventos

3. **Storage Bucket:**
   - Bucket `event-images` para armazenar imagens
   - Políticas de acesso público para leitura
   - Políticas de upload para usuários autenticados

## Verificação

Após aplicar a migration, verifique se:

1. A tabela `events` tem os novos campos
2. As políticas RLS foram criadas
3. O bucket `event-images` existe no Storage

## Troubleshooting

### Erro: "bucket already exists"
Se o bucket já existir, você pode ignorar esse erro. A migration usa `ON CONFLICT DO NOTHING`.

### Erro: "policy already exists"
As políticas usam `IF NOT EXISTS`, então podem ser executadas múltiplas vezes sem problemas.

### Erro de permissão
Certifique-se de estar usando uma conta com permissões de administrador no Supabase.
