# Agendamento Barbearia

Sistema de agendamento da Underground Barbershop. A especificação completa (ESPECIFICACAO.md) é a
fonte de verdade — leia antes de mudanças grandes e siga as fases na ordem.

## Comandos
- `npm run dev` — servidor local
- `npm run build` — checagem de tipos + build
- `npm test` — Vitest
- `npm run lint` / `npm run format`

## Convenções
- Interface, mensagens e nomes de domínio em português do Brasil.
- Datas como texto `yyyy-MM-dd`, horas como `HH:mm`; cálculos em minutos desde 00:00.
- Fuso sempre `America/Sao_Paulo` (`src/lib/datas.ts`), nunca o do aparelho.
- Telefones só com dígitos, com DDI: `5511987654321` (`src/lib/telefone.ts`).
- O front só fala com o back-end por `src/lib/api.ts`. Com `VITE_DEMO` diferente de `false`, as
  ações são atendidas por `src/lib/mock.ts` (dados no localStorage); o contrato é o da seção 5.3.
- Classes de componente (`btn-gold`, `card`, `campo`…) ficam em `src/index.css` como `@utility`.
