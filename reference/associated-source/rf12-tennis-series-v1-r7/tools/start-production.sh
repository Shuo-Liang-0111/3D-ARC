#!/usr/bin/env bash
set -euo pipefail

repo_root=.
unit_dir="${XDG_CONFIG_HOME:-$HOME/.config}/systemd/user"
unit_link="$unit_dir/arc.service"

cd "$repo_root"
mkdir -p "$unit_dir"
ln -sfn "$repo_root/tools/arc.service" "$unit_link"
systemctl --user daemon-reload
systemctl --user enable arc.service
systemctl --user restart arc.service
systemctl --user is-active --quiet arc.service
printf 'ARC 3D production service is active on port 4176\n'
