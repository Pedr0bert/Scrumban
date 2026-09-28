-- Fila de operações remotas (Telegram hoje, app mobile amanhã) aguardando o desktop.
CREATE TABLE IF NOT EXISTS inbox (
    id          TEXT PRIMARY KEY,           -- id da operação (também é o id da tarefa em 'create')
    type        TEXT NOT NULL,              -- 'create' | 'move'
    payload     TEXT NOT NULL,              -- JSON da operação
    source      TEXT NOT NULL DEFAULT 'telegram',
    created_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_inbox_created ON inbox (created_at);

-- Última fotografia (somente leitura) do quadro, enviada pelo desktop.
CREATE TABLE IF NOT EXISTS snapshot (
    id          INTEGER PRIMARY KEY CHECK (id = 1),
    data        TEXT NOT NULL,
    updated_at  TEXT NOT NULL
);

-- Idempotência do webhook: o Telegram reenvia updates em caso de falha/timeout.
CREATE TABLE IF NOT EXISTS processed_updates (
    update_id   INTEGER PRIMARY KEY,
    created_at  TEXT NOT NULL
);
