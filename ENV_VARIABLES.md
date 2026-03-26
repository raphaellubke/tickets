# Variáveis de Ambiente Necessárias

Configure estas variáveis no Coolify antes do deploy:

## Obrigatórias

```
NEXT_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua_chave_anon_key
```

## Opcionais (com valores padrão)

```
NODE_ENV=production
NEXT_TELEMETRY_DISABLED=1
PORT=3000
```

## Como obter as credenciais do Supabase

1. Acesse o dashboard do Supabase: https://supabase.com/dashboard
2. Selecione seu projeto
3. Vá em Settings > API
4. Copie:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`


