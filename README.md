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

### Pagamento (na barbearia ou online pelo Asaas)

- **Agendamento:** no último passo o cliente escolhe *Pagar na barbearia* ou *Pagar agora* (Pix ou
  cartão). Online, o horário é reservado e aparece o QR do Pix com "copia e cola" (ou o botão da
  página segura do Asaas para cartão); a tela acompanha o status sozinha até confirmar. Quem escolheu
  pagar no balcão pode pagar online depois pelo link "meu agendamento".
- **Plano:** contratação em `/assinar/:planoId` (plano, barbeiro, dia fixo opcional, dados e
  pagamento). Online vira **assinatura mensal no Asaas** (cobrança automática todo mês); no balcão, o
  plano fica "Aguardando 1º pagamento" até o admin clicar **Recebido no balcão** em Assinantes.
- **Painel:** selo de pagamento em cada horário (Pago · Pix, Pagar no local, Aguardando, Estornado) e
  coluna "Pagamento" no Excel. Concluir um atendimento "pagar no local" marca como pago; cancelar um
  horário pago online marca para estorno.
- **Na demonstração** não existe servidor: as cobranças são simuladas (QR ilustrativo, nenhum valor
  cobrado) e há um botão "Simular pagamento aprovado" no lugar do aviso do Asaas.

#### Como ligar o Asaas de verdade

A integração roda **só no servidor** (funções da Vercel em `api/`): `api/pagamentos.ts` cria e
consulta cobranças e `api/asaas/webhook.ts` recebe as confirmações. O valor cobrado vem do banco,
nunca do navegador. GitHub Pages não executa essas funções; para pagamentos reais o site precisa
estar publicado na Vercel com `VITE_DEMO=false` e o back-end (Apps Script) pronto.

1. Crie uma conta de **homologação (sandbox)** no Asaas e gere uma chave (`$aact_hmlg_...`) para testar.
2. Na Vercel, cadastre as variáveis `ASAAS_API_KEY`, `ASAAS_AMBIENTE=sandbox` e
   `ASAAS_WEBHOOK_TOKEN` (um texto aleatório com 32+ caracteres). **Nunca** coloque a chave no
   código, no `.env` versionado ou em variável com prefixo `VITE_` (essas vão para o navegador).
3. No Asaas, crie o webhook apontando para `https://<seu-dominio>/api/asaas/webhook`, com o mesmo
   token de autenticação e os eventos de cobrança (`PAYMENT_CONFIRMED`, `PAYMENT_RECEIVED`,
   `PAYMENT_OVERDUE`, `PAYMENT_REFUNDED`, `PAYMENT_DELETED`).
4. Testado tudo no sandbox, troque para a chave de produção (`$aact_prod_...`) e
   `ASAAS_AMBIENTE=producao`. A função recusa chave de produção com ambiente de sandbox e vice-versa.

O Apps Script precisa de três ações **internas** (só o servidor chama, com o `API_SECRET`):

| Ação | Recebe | Faz |
|---|---|---|
| `dadosParaCobranca` | `{ tipo: 'agendamento' \| 'assinatura', token }` | Devolve `{ referencia ('ag:<id>' ou 'as:<id>'), valor, descricao, cliente: { nome, telefone }, cobranca_existente }` a partir do banco |
| `registrarCobranca` | `{ referencia, cobrancaId, metodo, asaasAssinaturaId? }` | Grava a cobrança no agendamento/assinatura (pagamento `PENDENTE`) |
| `processarPagamentoAsaas` | `{ eventoId, evento, cobrancaId, status, referencia, asaasAssinaturaId, valor }` | Ignora `eventoId` repetido; `PAGO` marca o agendamento como pago ou ativa/renova a assinatura (`pago_ate`); `VENCIDO` deixa a assinatura `ATRASADA`; `ESTORNADO` registra o estorno |

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
