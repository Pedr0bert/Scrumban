//! Tema dos widgets nativos.
//!
//! No Linux, o WebKitGTK desenha o menu do `<select>`, o popover do calendário
//! de `<input type="date">` e a barra de título com o tema GTK do sistema — não
//! com o CSS da página. Com um tema de sistema escuro e o app em tema claro (ou
//! o contrário), esses elementos ficavam com fundo preto sobre a interface clara.
//!
//! Aqui descobrimos a preferência do sistema (para o modo "Sistema" do app) e
//! normalizamos o tema GTK para um que tenha variantes clara e escura. A partir
//! daí, o JS alterna claro/escuro via `Window::set_theme`, que no Linux liga ou
//! desliga `gtk-application-prefer-dark-theme`.

/// Retorna `true` se o sistema operacional estiver em modo escuro.
#[cfg(target_os = "linux")]
pub fn preparar_tema_nativo() -> bool {
    use gtk::prelude::*;

    // Quem forçou GTK_THEME manualmente sabe o que quer: respeitamos.
    if let Ok(forcado) = std::env::var("GTK_THEME") {
        return forcado.to_lowercase().contains("dark");
    }

    let Some(settings) = gtk::Settings::default() else { return false };
    let nome_tema = settings
        .gtk_theme_name()
        .map(|s| s.to_string())
        .unwrap_or_default();
    let tema_escuro_por_nome = nome_tema.to_lowercase().contains("dark");
    let escuro = tema_escuro_por_nome
        || settings.is_gtk_application_prefer_dark_theme()
        || gnome_prefere_escuro();

    // Temas que só existem na versão escura (ex.: "Yaru-dark", "Adwaita-dark")
    // ignoram prefer-dark=false. Troca por Adwaita, que tem as duas variantes.
    if tema_escuro_por_nome {
        settings.set_gtk_theme_name(Some("Adwaita"));
    }
    escuro
}

#[cfg(target_os = "linux")]
fn gnome_prefere_escuro() -> bool {
    std::process::Command::new("gsettings")
        .args(["get", "org.gnome.desktop.interface", "color-scheme"])
        .output()
        .map(|o| String::from_utf8_lossy(&o.stdout).contains("prefer-dark"))
        .unwrap_or(false)
}

/// Em Windows/macOS a webview já segue o tema do sistema; o JS usa matchMedia.
#[cfg(not(target_os = "linux"))]
pub fn preparar_tema_nativo() -> bool {
    false
}
