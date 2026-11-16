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

Para publicar a demonstração, importe o repositório na Vercel (framework Vite); não precisa de
variáveis de ambiente.

## O que dá para ver

| Rota | Conteúdo |
|---|---|
| `/` | Landing page: serviços, equipe, espaço, como funciona, localização |
| `/agendar` | Agendamento em 5 passos + confirmação (código, `.ics`, link) |
| `/meu-agendamento/:token` | Consulta e cancelamento pelo cliente |
| `/privacidade` | Aviso de privacidade |
| `/admin/login` → `/admin` | Painel demo: agenda do dia por barbeiro (`admin`/`demo` ou `renato`/`demo`) |

## Dados de exemplo a revisar

Ficam em `src/lib/mock.ts`: serviços, preços e durações, horário de funcionamento e nomes dos
barbeiros são provisórios. Endereço, WhatsApp e Instagram vieram do perfil da barbearia.

## Próximas fases

Planilha + Apps Script, proxy na Vercel, painel completo e WhatsApp, conforme a especificação.
Quando o back-end existir, basta definir `VITE_DEMO=false` para o front usar `/api/gas`.
