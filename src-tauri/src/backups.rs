//! Backups automáticos em disco.
//!
//! O IndexedDB da webview fica escondido no perfil do WebKit e some se esse
//! perfil for apagado. No desktop, o app grava também uma cópia diária em
//! `<dados do app>/backups/scrumban-auto-AAAA-MM-DD.json`, mantendo as últimas
//! `MAX_BACKUPS` cópias.

use serde::Serialize;
use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::time::UNIX_EPOCH;
use tauri::{AppHandle, Manager};
use tauri_plugin_opener::OpenerExt;

const PREFIXO: &str = "scrumban-auto-";
const MAX_BACKUPS: usize = 14;
const MAX_TAMANHO: usize = 512 * 1024 * 1024;

#[derive(Serialize)]
pub struct BackupInfo {
    nome: String,
    tamanho: u64,
    modificado_ms: u64,
}

pub fn pasta_backups(app: &AppHandle) -> tauri::Result<PathBuf> {
    Ok(app.path().app_data_dir()?.join("backups"))
}

/// Grava em arquivo temporário e renomeia: nunca deixa um backup pela metade.
pub fn gravar_atomico(destino: &Path, dados: &[u8]) -> std::io::Result<()> {
    let tmp = destino.with_extension("tmp-scrumban");
    {
        let mut f = fs::File::create(&tmp)?;
        f.write_all(dados)?;
        f.sync_all()?;
    }
    fs::rename(&tmp, destino)
}

fn dia_valido(dia: &str) -> bool {
    let b = dia.as_bytes();
    b.len() == 10
        && b[4] == b'-'
        && b[7] == b'-'
        && b.iter().enumerate().all(|(i, c)| i == 4 || i == 7 || c.is_ascii_digit())
}

/// Aceita só nomes gerados por este módulo (impede ler arquivos fora da pasta).
fn nome_valido(nome: &str) -> bool {
    nome.strip_prefix(PREFIXO)
        .and_then(|r| r.strip_suffix(".json"))
        .is_some_and(dia_valido)
}

fn listar(pasta: &Path) -> Vec<BackupInfo> {
    let mut itens: Vec<BackupInfo> = fs::read_dir(pasta)
        .into_iter()
        .flatten()
        .flatten()
        .filter_map(|e| {
            let nome = e.file_name().to_string_lossy().to_string();
            if !nome_valido(&nome) {
                return None;
            }
            let meta = e.metadata().ok()?;
            let modificado_ms = meta
                .modified()
                .ok()
                .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
                .map(|d| d.as_millis() as u64)
                .unwrap_or(0);
            Some(BackupInfo { nome, tamanho: meta.len(), modificado_ms })
        })
        .collect();
    // O nome contém a data ISO: ordem alfabética reversa = mais recente primeiro
    itens.sort_by(|a, b| b.nome.cmp(&a.nome));
    itens
}

/// Grava (ou atualiza) o backup do dia `dia` (AAAA-MM-DD, no fuso local do usuário).
#[tauri::command]
pub fn backup_automatico(app: AppHandle, dia: String, conteudo: String) -> Result<Vec<BackupInfo>, String> {
    if !dia_valido(&dia) {
        return Err("Data inválida".into());
    }
    if conteudo.len() > MAX_TAMANHO {
        return Err("Backup excede 512 MB".into());
    }
    serde_json::from_str::<serde_json::Value>(&conteudo).map_err(|_| "Conteúdo não é um JSON válido".to_string())?;

    let pasta = pasta_backups(&app).map_err(|e| e.to_string())?;
    fs::create_dir_all(&pasta).map_err(|e| e.to_string())?;
    gravar_atomico(&pasta.join(format!("{PREFIXO}{dia}.json")), conteudo.as_bytes()).map_err(|e| e.to_string())?;

    let itens = listar(&pasta);
    for antigo in itens.iter().skip(MAX_BACKUPS) {
        let _ = fs::remove_file(pasta.join(&antigo.nome));
    }
    Ok(listar(&pasta))
}

#[tauri::command]
pub fn listar_backups(app: AppHandle) -> Result<Vec<BackupInfo>, String> {
    Ok(listar(&pasta_backups(&app).map_err(|e| e.to_string())?))
}

#[tauri::command]
pub fn ler_backup(app: AppHandle, nome: String) -> Result<String, String> {
    if !nome_valido(&nome) {
        return Err("Nome de backup inválido".into());
    }
    let pasta = pasta_backups(&app).map_err(|e| e.to_string())?;
    fs::read_to_string(pasta.join(nome)).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn abrir_pasta_backups(app: AppHandle) -> Result<(), String> {
    let pasta = pasta_backups(&app).map_err(|e| e.to_string())?;
    fs::create_dir_all(&pasta).map_err(|e| e.to_string())?;
    app.opener()
        .open_path(pasta.to_string_lossy(), None::<&str>)
        .map_err(|e| e.to_string())
}

#[cfg(test)]
mod testes {
    use super::*;

    #[test]
    fn valida_nomes() {
        assert!(nome_valido("scrumban-auto-2026-10-08.json"));
        assert!(!nome_valido("scrumban-auto-2026-10-08.json.tmp"));
        assert!(!nome_valido("../etc/passwd"));
        assert!(!nome_valido("scrumban-auto-../../x.json"));
        assert!(!nome_valido("scrumban-auto-2026-1a-08.json"));
    }
}
