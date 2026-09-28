#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  // No Linux, o WebKitGTK renderiza a caixa e o menu do <select> nativo usando
  // o tema GTK do sistema, não o CSS da página. Se o tema do sistema for escuro
  // (ou algumas variações do Adwaita), isso deixa o fundo preto mesmo com o
  // Scrumban em tema claro. Forçamos um tema GTK claro para esses widgets
  // nativos, sem afetar quem já definiu GTK_THEME manualmente.
  #[cfg(target_os = "linux")]
  {
    if std::env::var("GTK_THEME").is_err() {
      std::env::set_var("GTK_THEME", "Adwaita:light");
    }
  }

  tauri::Builder::default()
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
