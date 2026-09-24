#!/bin/zsh
set -eu
project_dir="${0:A:h:h}"
tools_dir="$project_dir/.local-tools"
cd "$project_dir"
if [[ ! -x "$tools_dir/frankenphp" || ! -x "$tools_dir/mysql-8.4.11-macos15-x86_64/bin/mysqld" ]]; then
  print -u2 'Local PHP/MySQL tools are not installed in .local-tools.'
  exit 1
fi
if ! nc -z 127.0.0.1 3307; then
  "$tools_dir/mysql-8.4.11-macos15-x86_64/bin/mysqld" --no-defaults --basedir="$tools_dir/mysql-8.4.11-macos15-x86_64" --datadir="$tools_dir/mysql-data" --bind-address=127.0.0.1 --port=3307 --socket="$tools_dir/mysql.sock" --mysqlx=0 --log-error="$tools_dir/mysql.log" --pid-file="$tools_dir/mysql.pid" --daemonize
fi
"$tools_dir/frankenphp" php-cli scripts/ensure-local-db.php
if curl -fsS http://127.0.0.1:8080/api/public/faq >/dev/null; then
  print 'Test site is already running: http://127.0.0.1:8080'
  exit 0
fi
export THEATRE_PROJECT_ROOT="$project_dir"
exec "$tools_dir/frankenphp" run --config scripts/Caddyfile
