# Scrumban — Bot do Telegram (Cloudflare Worker + D1)

Acesso remoto ao Scrumban pelo celular: capturar tarefas, consultar o quadro e mover cards, mesmo com o PC desligado.

```
Telegram ──webhook──▶ Worker ──▶ D1 (inbox de operações + snapshot do quadro)
                                   ▲                 │
       Scrumban desktop ── PUT snapshot     GET inbox / POST ack ──▶ aplica no IndexedDB
```

- O **desktop continua sendo a fonte da verdade**. O Worker guarda só uma fila de operações (`create`, `move`) e a última fotografia do quadro publicada pelo desktop.
- Consultas (`/quadro`, `/foco`…) leem essa fotografia, então refletem o estado da **última sincronização** (a idade aparece no rodapé da resposta).
- Ações (`capturar`, `/mover`…) entram na fila e são aplicadas quando o desktop sincroniza (ao abrir, ao focar a janela ou pelo botão).

## Comandos

| Mensagem | Efeito |
| :-- | :-- |
| `Corrigir login #Meu Produto !alta ~dificil @amanha` | Cria no Backlog. Linhas extras viram descrição. |
| `/quadro` | Contagem por coluna, WIP, atrasadas e tarefas em andamento |
| `/foco` · `/todo` · `/backlog` | Lista a coluna (com a *ref* de 6 caracteres de cada tarefa) |
| `/hoje` · `/atrasadas` | Prazos |
| `/buscar termo` · `/ver ref` | Busca e detalhes |
| `/mover ref coluna` · `/iniciar ref` · `/feito ref` | Coloca o movimento na fila |
| `/pendentes` · `/desfazer` | Mostra ou cancela a última operação ainda não sincronizada |

Prazos aceitos: `@hoje`, `@amanha`, `@+3`, `@seg`…`@dom`, `@25/09`, `@25/09/2026`, `@2026-09-25` (fuso em `TIME_ZONE`).
Colunas: `backlog`, `todo`, `andamento`, `teste`, `feito` (e sinônimos).

## Deploy (plano gratuito da Cloudflare)

1. Crie o bot no **@BotFather** → guarde o token. Descubra seu user id numérico (ex.: **@userinfobot**).
2. Instale e crie o banco:
   ```bash
   cd telegram-bot
   npm install
   npx wrangler login
   npx wrangler d1 create scrumban-bot     # copie o database_id para o wrangler.toml
   npm run db:init:remote
   ```
3. Configure os segredos (gere valores aleatórios, ex.: `openssl rand -hex 32`):
   ```bash
   npx wrangler secret put TELEGRAM_BOT_TOKEN
   npx wrangler secret put TELEGRAM_WEBHOOK_SECRET
   npx wrangler secret put TELEGRAM_ALLOWED_USER_ID   # ex.: 123456789 (vários: separados por vírgula)
   npx wrangler secret put API_KEY
   ```
4. Publique e registre o webhook:
   ```bash
   npm run deploy    # mostra a URL: https://scrumban-bot.<conta>.workers.dev
   curl -s "https://api.telegram.org/bot<TOKEN>/setWebhook" \
     -d "url=https://scrumban-bot.<conta>.workers.dev/telegram/webhook" \
     -d "secret_token=<TELEGRAM_WEBHOOK_SECRET>" \
     -d 'allowed_updates=["message","edited_message"]'
   ```
5. No Scrumban desktop: **Configurações → Acesso Remoto (Telegram)** → cole a URL do Worker e a `API_KEY` → *Salvar & Conectar*.
6. (Opcional) Registre os comandos no menu do Telegram via `@BotFather → /setcommands`.

## Desenvolvimento local

```bash
cp .dev.vars.example .dev.vars
npm run db:init:local
npm run dev
```

## Segurança

- Webhook validado pelo header `X-Telegram-Bot-Api-Secret-Token`; mensagens de usuários fora de `TELEGRAM_ALLOWED_USER_ID` são ignoradas em silêncio.
- API protegida por `Authorization: Bearer <API_KEY>` (comparação em tempo constante). No desktop, o token fica em `localStorage` próprio e **não** vai para o backup JSON.
- Updates repetidos do Telegram são descartados por `update_id` (sem tarefas duplicadas). A criação é idempotente também no desktop (o id da tarefa é gerado no servidor).
- **Privacidade:** o snapshot (títulos, projetos, prazos e os primeiros 500 caracteres da descrição) fica armazenado no seu D1 na Cloudflare. Imagens e histórico de sprints não são enviados.

## Contrato da API (reutilizável pelo app mobile)

| Rota | Corpo / Resposta |
| :-- | :-- |
| `GET /api/inbox` | `{ items: [{ id, type: "create"\|"move", payload, source, createdAt }] }` em ordem de criação |
| `POST /api/inbox/ack` | `{ ids: [...] }` → `{ removed }` |
| `GET /api/snapshot` | último snapshot + `receivedAt` (404 se nunca publicado) |
| `PUT /api/snapshot` | `{ version, generatedAt, projects, wipLimit, currentSprint, tasks: [...] }` (máx. 1 MB) |

Payloads: `create` → `{ taskId, title, description, project, priority, difficulty, dueDate, createdAt }`; `move` → `{ taskId, column, requestedAt }`.
