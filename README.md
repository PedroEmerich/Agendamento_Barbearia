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
| `/admin/login` → `/admin` | Painel demo: agenda do dia por barbeiro (`admin`/`demo` ou `renato`/`demo`) |

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
