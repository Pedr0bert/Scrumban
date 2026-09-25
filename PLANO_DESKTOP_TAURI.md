# Planejamento Técnico: App Desktop Nativo com Tauri v2

> **Status:** 📋 Planejado (Ambiente já verificado e compatível)  
> **Data de Planejamento:** 15 de Setembro de 2026  
> **Objetivo:** Empacotar o SCRUMBAN em uma aplicação desktop nativa leve, rápida e com baixo consumo de memória (~35MB de RAM), eliminando a necessidade de abrir no navegador via `http.server` ou `file://`.

---

## 1. Por que Tauri para o SCRUMBAN?

O SCRUMBAN utiliza HTML semântico, Tailwind CSS compilado localmente e Vanilla JS (ES Modules). O Tauri v2 encaixa perfeitamente nesse modelo:

* **Consumo Mínimo de Recursos:** Usa o WebKitGTK nativo do sistema operacional Linux, consumindo apenas ~35MB de RAM (contra ~350MB+ do Electron).
* **Binário Nativo Autônomo:** Gera executáveis nativos (.deb, .AppImage ou binário único) sem carregar um Chromium embutido.
* **100% de Aproveitamento do Código:** O frontend existente (`index.html`, `css/tailwind.min.css`, `js/app.js`) é utilizado sem nenhuma necessidade de reescrita.
* **Base Sólida para Próximos Passos:** Permite adicionar no futuro:
  - Ícone na bandeja do sistema (*System Tray*);
  - Notificações nativas do Linux sobre prazos de tarefas (*Overdue/Hoje*);
  - Processo em segundo plano para ingestão das tarefas vindas do Telegram.

---

## 2. Diagnóstico do Ambiente Local (Linux)

Verificamos os pré-requisitos no seu sistema operacional e **o ambiente já está 100% pronto**:

| Dependência | Status no seu Sistema | Versão Encontrada |
| :--- | :---: | :--- |
| **Rust & Cargo** | ✅ Instalado | `rustc 1.95.0` / `cargo 1.95.0` |
| **WebKitGTK** | ✅ Instalado | `webkit2gtk-4.1` (v2.52.6) |
| **Node.js & npm** | ✅ Instalado | Presente no projeto |
| **Build Tools (C/C++)** | ✅ Instalado | `pkg-config`, `gcc` disponíveis |

---

## 3. Arquitetura do Projeto com Tauri

Ao integrar o Tauri, a estrutura de pastas do projeto ficará assim:

```
v4/
├── assets/                   # Ícones da aplicação
├── css/                      # Estilos Tailwind compilados
├── js/                       # Módulos JS da aplicação
├── index.html                # Aplicação web principal
├── package.json              # Scripts npm + CLI do Tauri
├── src-tauri/                # 🦀 Núcleo nativo Tauri (Rust)
│   ├── Cargo.toml            # Dependências Rust do Tauri v2
│   ├── icons/                # Ícones da aplicação em múltiplos tamanhos
│   ├── src/
│   │   ├── lib.rs            # Inicialização da janela e comandos
│   │   └── main.rs           # Entrypoint do binário
│   └── tauri.conf.json       # Configuração da janela, build e permissões
```

---

## 4. Configuração do `tauri.conf.json`

O arquivo de configuração do Tauri mapeia diretamente os scripts do `package.json`:

```json
{
  "$schema": "https://schema.tauri.app/config/2",
  "productName": "Scrumban Pessoal",
  "version": "4.0.0",
  "identifier": "com.scrumban.pessoal",
  "build": {
    "beforeDevCommand": "npm run build",
    "beforeBuildCommand": "npm run build",
    "devUrl": "../",
    "frontendDist": "../"
  },
  "app": {
    "windows": [
      {
        "title": "Scrumban Pessoal",
        "width": 1280,
        "height": 820,
        "minWidth": 900,
        "minHeight": 600,
        "resizable": true,
        "fullscreen": false
      }
    ],
    "security": {
      "csp": null
    }
  },
  "bundle": {
    "active": true,
    "targets": ["appimage", "deb"],
    "icon": [
      "icons/32x32.png",
      "icons/128x128.png",
      "icons/128x128@2x.png",
      "icons/icon.png"
    ]
  }
}
```

---

## 5. Scripts no `package.json`

Adicionam-se os comandos Tauri aos scripts existentes:

```json
{
  "scripts": {
    "build:css": "tailwindcss -i ./css/input.css -o ./css/tailwind.min.css --minify",
    "watch:css": "tailwindcss -i ./css/input.css -o ./css/tailwind.min.css --watch",
    "build:js": "esbuild js/main.js --bundle --outfile=js/app.js",
    "watch:js": "esbuild js/main.js --bundle --outfile=js/app.js --watch",
    "build": "npm run build:css && npm run build:js",
    "tauri": "tauri",
    "tauri:dev": "npm run build && tauri dev",
    "tauri:build": "npm run build && tauri build"
  }
}
```

---

## 6. Persistência de Dados no Desktop

1. **Fase Inicial (Zero Atrito):**
   - O WebKitGTK no Linux possui suporte nativo completo ao **IndexedDB** (`scrumban_pessoal_db`), armazenando os dados na pasta do app (`~/.local/share/com.scrumban.pessoal/`).
   - Todos os dados existentes e o código de persistência em `js/storage.js` continuam funcionando imediatamente sem nenhuma alteração.
2. **Evolução Futura (Opcional):**
   - Migrar ou espelhar o backup em arquivo local (ex: `~/Documentos/scrumban_backup.json`) usando o plugin `@tauri-apps/plugin-fs` ou SQLite nativo.

---

## 7. Roteiro Passo a Passo de Execução

- [ ] **Passo 1: Instalação da CLI do Tauri**
  ```bash
  npm install -D @tauri-apps/cli@^2
  ```
- [ ] **Passo 2: Inicialização do Tauri no Projeto**
  ```bash
  npx tauri init --app-name "Scrumban Pessoal" --window-title "Scrumban Pessoal" --dist-dir "../" --dev-url "../"
  ```
- [ ] **Passo 3: Geração dos Ícones Desktop**
  - Gerar os ícones PNG em múltiplos tamanhos a partir do `assets/icon.svg` usando o gerador do Tauri:
  ```bash
  npx tauri icon assets/icon.svg
  ```
- [ ] **Passo 4: Validação em Modo de Desenvolvimento**
  ```bash
  npm run tauri:dev
  ```
  - Verificar abertura da janela, drag-and-drop, dark mode, atalhos de teclado e persistência no IndexedDB.
- [ ] **Passo 5: Compilação do Binário Final (.AppImage / .deb)**
  ```bash
  npm run tauri:build
  ```
  - O executável pronto fica gerado em `src-tauri/target/release/bundle/appimage/`.
