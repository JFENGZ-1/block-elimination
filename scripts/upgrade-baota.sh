#!/usr/bin/env bash
set -Eeuo pipefail

site_root="${1:-/www/wwwroot/demo.zjzoo.me}"
script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd -- "${script_dir}/.." && pwd)"
source_root="${repo_root}/deploy/wwwroot"

case "${site_root}" in
  /www/wwwroot/*) ;;
  *)
    echo "拒绝升级：站点目录必须位于 /www/wwwroot/ 下" >&2
    exit 1
    ;;
esac

if [[ ! -f "${source_root}/index.html" || ! -f "${source_root}/api/index.php" ]]; then
  echo "生产文件不完整，请先更新 GitHub 仓库。" >&2
  exit 1
fi

mkdir -p "${site_root}"
cp -a "${source_root}/." "${site_root}/"

if [[ -f "${site_root}/api/config.php" ]]; then
  chown root:www "${site_root}/api/config.php" 2>/dev/null || true
  chmod 640 "${site_root}/api/config.php"
fi

chmod 755 "${site_root}" "${site_root}/api"

version="$(tr -d '\r\n' < "${repo_root}/deploy/VERSION")"
echo "坨坨方块 ${version} 已升级完成：${site_root}"
echo "数据库配置 api/config.php 已保留。"
