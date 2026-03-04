# Supabase Setup (Social Real)

1. Crie um projeto no Supabase.
2. Em `Authentication > Providers`, mantenha `Email` ativo.
3. No SQL Editor, execute `supabase/schema.sql`.
4. Em `Project Settings > API`, copie:
   - `Project URL`
   - `anon public` key
5. Crie um arquivo `.env.local` na raiz do projeto com:

```env
NEXT_PUBLIC_SUPABASE_URL=COLE_AQUI
NEXT_PUBLIC_SUPABASE_ANON_KEY=COLE_AQUI
```

6. Rode local:

```bash
npm install
npm run dev
```

## Observacoes

- O app agora usa login real (email/senha) e username publico.
- Amigos e posts ficam no banco do Supabase.
- Se quiser, na tela de cadastro use username unico (ex.: `blankhunter`).
