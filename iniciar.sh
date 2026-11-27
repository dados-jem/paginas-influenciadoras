#!/bin/sh
set -eu
project_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd -P)
apply=0; login=0
for argument in "$@"; do
 case "$argument" in --apply) apply=1;; --login) login=1;; *) printf '%s\n' 'Uso: sh iniciar.sh [--apply] [--login]' >&2; exit 2;; esac
done
if [ "$apply" = 0 ]; then
 printf '%s\n' 'Prévia: preparar ferramentas isoladas, instalar dependências travadas e validar o projeto.' 'Nenhum download ou alteração. Para executar: sh iniciar.sh --apply [--login]'
 exit 0
fi
case "$(uname -s)" in Darwin) platform=darwin;; Linux) platform=linux;; *) printf '%s\n' 'No Windows, use iniciar.ps1.' >&2; exit 2;; esac
case "$(uname -m)" in arm64|aarch64) architecture=arm64;; x86_64|amd64) architecture=x64;; *) printf '%s\n' 'Arquitetura não suportada.' >&2; exit 2;; esac
row=$(awk -F '\t' -v key="${platform}_${architecture}" '$1 == key {print $2 " " $3}' "$project_dir/config/toolchain.tsv")
IFS=' ' read -r archive_url archive_sha <<EOF
$row
EOF
case "$archive_url" in https://github.com/prefix-dev/pixi/releases/download/v0.85.0/pixi-*.tar.gz) ;; *) printf '%s\n' 'Origem da ferramenta divergente.' >&2; exit 2;; esac
case "$archive_sha" in *[!a-f0-9]*|'') exit 2;; esac
[ "${#archive_sha}" = 64 ] || exit 2
hash_file() {
 if command -v sha256sum >/dev/null 2>&1; then sha256sum "$1" | awk '{print $1}'; else shasum -a 256 "$1" | awk '{print $1}'; fi
}
tool_dir="$project_dir/.runtime/tools/pixi"
if [ ! -f "$tool_dir/pixi" ]; then
 mkdir -p "$tool_dir"
 stage=$(mktemp -d "$tool_dir/install.XXXXXX")
 trap 'rm -rf "$stage"' EXIT HUP INT TERM
 printf '%s\n' 'Preparando ferramentas portáteis do projeto…'
 curl --fail --silent --show-error --location --proto '=https' --proto-redir '=https' --tlsv1.2 "$archive_url" -o "$stage/pixi.tar.gz"
 [ "$(hash_file "$stage/pixi.tar.gz")" = "$archive_sha" ] || { printf '%s\n' 'Checksum da ferramenta divergente.' >&2; exit 2; }
 tar -xzf "$stage/pixi.tar.gz" -C "$stage"
 [ -f "$stage/pixi" ] && [ ! -L "$stage/pixi" ] || exit 2
 mv "$stage/pixi" "$tool_dir/pixi"
 chmod 755 "$tool_dir/pixi"
 hash_file "$tool_dir/pixi" > "$tool_dir/binary.sha256"
fi
[ -f "$tool_dir/binary.sha256" ] && [ "$(hash_file "$tool_dir/pixi")" = "$(cat "$tool_dir/binary.sha256")" ] || { printf '%s\n' 'A ferramenta local mudou; concilie antes de continuar.' >&2; exit 2; }
[ "$("$tool_dir/pixi" --version)" = 'pixi 0.85.0' ] || exit 2
cd "$project_dir"
"$tool_dir/pixi" run --locked node scripts/bootstrap.mjs --automatic
if [ "$login" = 1 ]; then "$tool_dir/pixi" run --locked node scripts/jm.mjs login; fi
