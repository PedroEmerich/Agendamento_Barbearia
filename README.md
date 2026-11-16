# Agendamento — Underground Barbershop

Site de agendamento online da barbearia. **Estado atual: landing page + front demonstrativo.**
Não há back-end ainda: os dados são simulados no navegador (`src/lib/mock.ts`) e nenhuma mensagem
de WhatsApp é enviada.

## Rodar

```bash
npm install
npm run dev      # http://localhost:5173
npm test
npm run build
```

Para publicar a demonstração há duas opções, sem variáveis de ambiente:

- **GitHub Pages:** em *Settings → Pages → Source*, escolha **GitHub Actions**. O workflow
  `.github/workflows/pages.yml` compila e publica a cada push na `main`.
- **Vercel:** importe o repositório (framework Vite).

## O que dá para ver

| Rota | Conteúdo |
|---|---|
| `/` | Landing page: serviços, equipe, espaço, como funciona, localização |
| `/agendar` | Agendamento em 5 passos + confirmação (código, `.ics`, link) |
| `/meu-agendamento/:token` | Consulta e cancelamento pelo cliente |
| `/privacidade` | Aviso de privacidade |
| `/admin/login` → `/admin` | Painel demonstrativo (detalhes abaixo) |

### Painel (demonstração)

Entre em `/admin/login` (ou "Área do barbeiro" no rodapé):

| Login | Senha | Visão |
|---|---|---|
| `admin` | `demo` | Dono: os três barbeiros, com filtro por barbeiro |
| `davi`, `renato`, `renan` | `demo` | O próprio barbeiro: só a agenda e os números dele |

- **Início:** indicadores (semana, faturamento do mês, comparecimento, ticket médio), gráfico de
  agendamentos ou faturamento **por semana ou por mês** com a tendência, próximos clientes e serviços
  mais pedidos.
- **Agenda:** dia a dia, sem permitir datas passadas, com a quantidade de horários dos próximos 14 dias.
- **Relatórios:** período (semana, mês, mês passado, 3 meses ou datas livres), indicadores, por
  serviço, por dia da semana, por barbeiro e lista completa, com exportação para **PDF** e **Excel**.

### Planos de assinatura

- **Página inicial:** seção "Planos" com os três planos e o botão "Quero assinar" (WhatsApp).
- **Página do assinante** (`/assinatura/:token`, link pessoal, sem login): créditos do mês, dia fixo,
  próximos horários e as ações **Trocar / adiantar** (atalho com os horários livres antes do atual),
  **Não vou** (libera o horário e devolve o crédito) e **usar crédito livre**. A troca reserva o novo
  horário e libera o antigo numa operação só, então o cliente nunca fica sem horário nem perde crédito.
- **Painel → Assinantes:** lista com créditos, próximo horário, status de pagamento, link do cliente
  (abrir, copiar, enviar pelo WhatsApp), pausar/reativar, marcar mês pago e cadastrar assinante.
- Horários de plano aparecem com o selo **Plano** na agenda e entram nos relatórios (R$ 0 no
  atendimento; a receita vem da mensalidade).
- Para testar: Painel → Assinantes → "Página do cliente" (ex.: `/assinatura/assinatura-a1-demo`).

Regras provisórias (`src/lib/assinaturas.ts`), até a barbearia definir: ciclo = mês do calendário,
créditos não acumulam, falta conta como usado, trocas até 2h antes, assinante agenda até 45 dias à
frente (público: 21) e os dias fixos ficam reservados 5 semanas antes.

A agenda simulada é gerada em `src/lib/semente.ts`: ~6 meses de histórico com crescimento leve,
esta semana bem cheia e as próximas mais vazias. É determinística, então recarregar não muda nada;
mudanças de status e agendamentos feitos pelo site ficam salvos no navegador.

## Dados de exemplo a revisar

Ficam em `src/lib/mock.ts`: serviços, preços, durações e horário de funcionamento são
provisórios. Endereço, WhatsApp e Instagram vieram do perfil da barbearia.

Barbeiros, na ordem do site: Davi, Renato e Renan. As fotos ficam em `public/barbeiros/`
(`davi.webp`, `renato.webp`, `renan.webp`, 480×480); para trocar uma foto basta substituir o arquivo.

A logo fica em `public/marca/` com fundo transparente: `logo.webp` (completa), `leao.webp` e
`nome.webp` (partes usadas no cabeçalho e no topo da página) e `icone.png` (ícone do site).

## Próximas fases

Planilha + Apps Script, proxy na Vercel, painel completo e WhatsApp, conforme a especificação.
Quando o back-end existir, basta definir `VITE_DEMO=false` para o front usar `/api/gas`.
