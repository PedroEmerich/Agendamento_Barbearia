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
