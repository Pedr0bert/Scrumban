//! Scrumban Desktop — casca nativa (Tauri v2) da aplicação web.
//!
//! A interface continua sendo o mesmo HTML/JS da versão web; aqui ficam só as
//! integrações que o navegador não oferece bem no desktop:
//! - diálogo nativo "Salvar como…" para backup JSON, CSV e Markdown;
//! - backups automáticos diários em disco (com rotação);
//! - janela que lembra tamanho/posição, abre já pintada (sem flash branco)
//!   e não abre duas vezes;
//! - tema nativo (GTK no Linux) sincronizado com o tema do app.

mod backups;
mod tema;

use serde::Serialize;
use std::fs;
use std::time::Duration;
use tauri::{Manager, WebviewUrl, WebviewWindowBuilder};
use tauri_plugin_dialog::DialogExt;

const JANELA_PRINCIPAL: &str = "main";

#[derive(Serialize)]
struct ArquivoSalvo {
    caminho: String,
}

/// Abre o diálogo nativo "Salvar como…" e grava o conteúdo no arquivo escolhido.
/// Retorna `None` se o usuário cancelar.
#[tauri::command]
async fn salvar_arquivo(
    window: tauri::WebviewWindow,
    nome_sugerido: String,
    conteudo: String,
    filtro_nome: String,
    extensoes: Vec<String>,
) -> Result<Option<ArquivoSalvo>, String> {
    let exts: Vec<&str> = extensoes.iter().map(String::as_str).collect();
    let mut dialogo = window.dialog().file();
    // Começa em Downloads (ou Documentos/Home), não no diretório de trabalho do processo
    let caminhos = window.path();
    if let Some(pasta) = caminhos
        .download_dir()
        .or_else(|_| caminhos.document_dir())
        .or_else(|_| caminhos.home_dir())
        .ok()
        .filter(|p| p.is_dir())
    {
        dialogo = dialogo.set_directory(pasta);
    }
    let escolhido = dialogo
        .set_parent(&window)
        .set_title("Salvar arquivo")
        .set_file_name(nome_sugerido)
        .add_filter(filtro_nome, &exts)
        .blocking_save_file();

    let Some(caminho) = escolhido else { return Ok(None) };
    let caminho = caminho.into_path().map_err(|e| format!("Caminho inválido: {e}"))?;
    backups::gravar_atomico(&caminho, conteudo.as_bytes())
        .map_err(|e| format!("Não foi possível gravar {}: {e}", caminho.display()))?;
    Ok(Some(ArquivoSalvo { caminho: caminho.display().to_string() }))
}

#[tauri::command]
fn aplicar_tema_nativo(window: tauri::WebviewWindow, escuro: bool) -> Result<(), String> {
    let tema = if escuro { tauri::Theme::Dark } else { tauri::Theme::Light };
    window.set_theme(Some(tema)).map_err(|e| e.to_string())
}

fn mostrar_e_focar(app: &tauri::AppHandle) {
    if let Some(janela) = app.get_webview_window(JANELA_PRINCIPAL) {
        let _ = janela.unminimize();
        let _ = janela.show();
        let _ = janela.set_focus();
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default();

    #[cfg(desktop)]
    {
        // Precisa ser o primeiro plugin: uma segunda instância só foca a janela existente
        builder = builder.plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            mostrar_e_focar(app);
        }));
    }

    builder
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(
            tauri_plugin_window_state::Builder::new()
                // A visibilidade é controlada pelo app (janela abre oculta até o quadro renderizar)
                .with_state_flags(
                    tauri_plugin_window_state::StateFlags::all()
                        - tauri_plugin_window_state::StateFlags::VISIBLE,
                )
                .build(),
        )
        .invoke_handler(tauri::generate_handler![
            salvar_arquivo,
            aplicar_tema_nativo,
            backups::backup_automatico,
            backups::listar_backups,
            backups::ler_backup,
            backups::abrir_pasta_backups,
        ])
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            let sistema_escuro = tema::preparar_tema_nativo();
            let versao = app.package_info().version.to_string();
            let script_inicial = format!(
                "window.__SCRUMBAN_DESKTOP__ = Object.freeze({{ sistemaEscuro: {sistema_escuro}, versao: {versao:?} }});"
            );

            WebviewWindowBuilder::new(app, JANELA_PRINCIPAL, WebviewUrl::App("index.html".into()))
                .title("Scrumban")
                .inner_size(1360.0, 860.0)
                .min_inner_size(960.0, 620.0)
                .center()
                .visible(false)
                .theme(Some(if sistema_escuro { tauri::Theme::Dark } else { tauri::Theme::Light }))
                .zoom_hotkeys_enabled(true)
                // O handler nativo de arquivos arrastados conflita com o drag-and-drop HTML5 dos cards
                .disable_drag_drop_handler()
                .initialization_script(&script_inicial)
                .build()?;

            // Rede de segurança: se o JS falhar antes de chamar show(), a janela aparece mesmo assim
            let handle = app.handle().clone();
            std::thread::spawn(move || {
                std::thread::sleep(Duration::from_secs(4));
                if let Some(j) = handle.get_webview_window(JANELA_PRINCIPAL) {
                    if !j.is_visible().unwrap_or(true) {
                        let _ = j.show();
                    }
                }
            });

            let _ = fs::create_dir_all(backups::pasta_backups(app.handle())?);
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("erro ao iniciar o Scrumban");
}
