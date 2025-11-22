# Guia de Deploy no Coolify com Nixpacks

Este projeto está configurado para deploy no Coolify usando o Build Pack Nixpacks.

## Configuração no Coolify

### 1. Variáveis de Ambiente Necessárias

Configure as seguintes variáveis de ambiente no Coolify:

```
NEXT_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua_chave_anon
NODE_ENV=production
NEXT_TELEMETRY_DISABLED=1
PORT=3000
```

### 2. Configurações do Build

- **Build Pack**: Nixpacks
- **Build Command**: `npm run build` (automático via nixpacks.toml)
- **Start Command**: `npm start` (automático via nixpacks.toml)
- **Port**: 3000

### 3. Arquivos de Configuração

O projeto inclui os seguintes arquivos de configuração:

- `nixpacks.toml` - Configuração do Nixpacks
- `.coolify.yml` - Configuração adicional para Coolify
- `.dockerignore` - Arquivos ignorados no build
- `next.config.ts` - Configuração do Next.js com output standalone

### 4. Processo de Deploy

1. Conecte o repositório no Coolify
2. Selecione o Build Pack: **Nixpacks**
3. Configure as variáveis de ambiente
4. O Coolify irá:
   - Instalar dependências com `npm ci`
   - Executar `npm run build`
   - Iniciar a aplicação com `npm start`

### 5. Notas Importantes

- O Next.js está configurado com `output: 'standalone'` para otimizar o build
- O servidor inicia na porta 3000 (ou na porta definida pela variável PORT)
- Certifique-se de que as variáveis do Supabase estão configuradas corretamente

