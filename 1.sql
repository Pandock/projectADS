
bash <<'NGINX_AUDIT'
# ============================================================
# ПЕРЕМЕННЫЕ — ПРОВЕРЬ ПЕРЕД ЗАПУСКОМ
# ============================================================

NGINX_BIN="nginx"
NGINX_CONF="/etc/nginx/nginx.conf"

# Если служба запускается с нестандартным -p, укажи те же параметры.
NGINX_ARGS=(-c "$NGINX_CONF")

SERVICE_USER="nginx"
SERVICE_GROUP="nginx"

ETC_DIR="/etc/nginx"
SHARE_DIR="/usr/share/nginx"
PID_FILE="/var/run/nginx.pid"

# Укажи фактические пути из конфигурации.
# Пустое значение CORE_DIR означает, что путь пока неизвестен.
CORE_DIR=""
CERT_FILE="/etc/nginx/crt/server.crt"
KEY_FILE="/etc/nginx/crt/server.key"
DH_FILE="/etc/nginx/ssl/dhparam.pem"

ACCESS_LOG="/var/log/nginx/access.log"
ERROR_LOG="/var/log/nginx/error.log"
LOGROTATE_FILE="/etc/logrotate.d/nginx"

# Для проверки доверия сертификату:
# CA_FILE — доверенный корневой сертификат корпоративного УЦ.
# CHAIN_FILE — промежуточные сертификаты, если они нужны.
CA_FILE=""
CHAIN_FILE=""

# Для HTTP/HTTPS-проверок:
# HOST — доменное имя сервиса, совпадающее с сертификатом.
# TARGET_IP — IP именно проверяемого Nginx; можно оставить пустым,
# тогда будет использован DNS.
HOST=""
TARGET_IP=""
HTTPS_PORT="443"

# Если фактически используются другие URI — замени.
INDEX_PATH="/index.html"
ERROR_PATH="/__nginx_audit_nonexistent_page_$(date +%s)"
HIDDEN_PATH="/.htpasswd"

# ============================================================
# ПОДГОТОВКА
# ============================================================

export LC_ALL=C

section() {
    printf '\n============================================================\n'
    printf '%s\n' "$1"
    printf '============================================================\n'
}

# Поиск директив в конфигурации.
# Отсутствие строки не всегда означает отключение:
# могут действовать значения по умолчанию.
show_cfg() {
    local result
    result=$(printf '%s\n' "$CFG" | grep -nE "$1" || true)
    if [[ -n "$result" ]]; then
        printf '%s\n' "$result"
    else
        printf '%s\n' "[Явная директива не найдена]"
    fi
}

section "Подготовка: экземпляр Nginx, параметры службы, проверка конфигурации"

sudo -v || exit 1

command -v "$NGINX_BIN" || exit 1

sudo "$NGINX_BIN" -v 2>&1

printf '\n--- Параметры запуска systemd-службы ---\n'
systemctl show nginx \
    -p ExecStart -p User -p Group -p LimitCORE --no-pager 2>/dev/null || true

printf '\n--- Работающие процессы ---\n'
ps -eo user,group,pid,ppid,args | grep '[n]ginx' || true

printf '\n--- Проверка конфигурации и чтение include-файлов ---\n'
# Сообщения проверки идут в stderr, конфигурация сохраняется в переменной.
if ! CFG=$(sudo "$NGINX_BIN" -T "${NGINX_ARGS[@]}"); then
    printf '\nОШИБКА: nginx -T не выполнен. Исправь путь/параметры/доступ.\n'
    exit 1
fi

BUILD=$(sudo "$NGINX_BIN" -V 2>&1)

printf '\n--- Файлы, участвующие в конфигурации ---\n'
printf '%s\n' "$CFG" | grep '^# configuration file ' || true

# HTTP-проверки не отключают проверку сертификата.
CURL_ARGS=(
    --silent --show-error
    --connect-timeout 5 --max-time 15
    --noproxy '*'
)

if [[ -n "$CA_FILE" ]]; then
    CURL_ARGS+=(--cacert "$CA_FILE")
fi

HTTP_READY=0
ROOT_HEADERS=""

if [[ -n "$HOST" ]]; then
    BASE_URL="https://${HOST}:${HTTPS_PORT}"

    if [[ -n "$TARGET_IP" ]]; then
        CURL_ARGS+=(--resolve "${HOST}:${HTTPS_PORT}:${TARGET_IP}")
    fi

    printf '\n--- Пробный GET к %s ---\n' "$BASE_URL"
    if ROOT_HEADERS=$(curl "${CURL_ARGS[@]}" \
        -D - -o /dev/null "${BASE_URL}/"); then
        HTTP_READY=1
    else
        printf '%s\n' \
          "HTTP-проверки пропущены: не удалось получить ответ." \
          "Проверь HOST, TARGET_IP, доверенный УЦ и доступность сервиса." \
          "Проверка доверия TLS намеренно не отключается."
    fi
else
    printf '\nHOST не задан: HTTP-проверки будут пропущены.\n'
fi

show_response_headers() {
    if [[ "$HTTP_READY" == 1 ]]; then
        printf '%s\n' "$ROOT_HEADERS" | tr -d '\r'
    else
        printf '%s\n' "[HTTP-проверка пропущена]"
    fi
}

# ============================================================
# ПРОВЕРКИ — В ПОРЯДКЕ ТВОЕГО СПИСКА
# ============================================================

section "01. Динамические модули: активных load_module быть не должно"
show_cfg '^[[:space:]]*load_module[[:space:]]'

section "02. WebDAV: модуль отсутствует либо dav_methods off"
printf '%s\n' "$BUILD" |
    grep -oE -- '--[^[:space:]]*dav[^[:space:]]*' || true
show_cfg '^[[:space:]]*(load_module|dav_methods)[[:space:]]'
# --with-http_dav_module означает наличие встроенного модуля.

section "03. Gzip: модуль отсутствует либо gzip off"
printf '%s\n' "$BUILD" |
    grep -oE -- '--[^[:space:]]*gzip[^[:space:]]*' || true
show_cfg '^[[:space:]]*(gzip|gzip_static|load_module)[[:space:]]'
# Для основного gzip-модуля признак исключения:
# --without-http_gzip_module
# Пустой вывод nginx -V по gzip НЕ доказывает отсутствие модуля.

section "04. Autoindex: модуль должен отсутствовать"
printf '%s\n' "$BUILD" |
    grep -oE -- '--[^[:space:]]*autoindex[^[:space:]]*' || true
show_cfg '^[[:space:]]*(autoindex|load_module)[[:space:]]'
# Признак исключения: --without-http_autoindex_module.
# autoindex off отключает функционал, но не удаляет модуль из сборки.

section "05. Модуль http_status_module должен отсутствовать"
printf '%s\n' "$BUILD" |
    grep -oE -- '--[^[:space:]]*status[^[:space:]]*' || true
show_cfg '^[[:space:]]*(load_module|status|status_zone|api)[[:space:];{]'
# Для сторонних модулей дополнительно требуется состав сборки/пакета.
# Пустой grep не является универсальным доказательством отсутствия.

section "06. Модуль http_stub_status_module должен отсутствовать"
printf '%s\n' "$BUILD" |
    grep -oE -- '--[^[:space:]]*stub_status[^[:space:]]*' || true
show_cfg '^[[:space:]]*(stub_status|load_module)[[:space:];]'

section "07. Выделенная УЗ: user nginx, запись в системе, worker-процессы"
show_cfg '^[[:space:]]*user[[:space:]]'
getent passwd "$SERVICE_USER"
id "$SERVICE_USER"
ps -eo user,group,pid,ppid,args | grep '[n]ginx' || true
# Сверить именно worker process.
# Master-процесс может работать от root.
# Worker не должен работать от root, nobody или daemon.

section "08. Пароль сервисной УЗ заблокирован: L или LK"
sudo passwd -S "$SERVICE_USER"

section "09. Оболочка сервисной УЗ: nologin"
getent passwd "$SERVICE_USER"
getent passwd "$SERVICE_USER" |
    awk -F: '{printf "user=%s uid=%s gid=%s shell=%s\n",$1,$3,$4,$7}'

section "10. Владельцы /etc/nginx и /usr/share/nginx: root"
sudo stat -Lc '%n | owner=%U | group=%G | mode=%a' \
    "$ETC_DIR" "$SHARE_DIR"

section "11. Каталоги: 755; обычные файлы: 644"
printf '\n--- Корневые каталоги ---\n'
sudo stat -Lc '%n | owner=%U | group=%G | mode=%a' \
    "$ETC_DIR" "$SHARE_DIR"

printf '\n--- Каталоги с правами НЕ 755 ---\n'
sudo find "$ETC_DIR" "$SHARE_DIR" \
    -type d ! -perm 0755 -printf '%m %u:%g %p\n'

printf '\n--- Обычные файлы с правами НЕ 644 ---\n'
sudo find "$ETC_DIR" "$SHARE_DIR" \
    -type f ! -perm 0644 -printf '%m %u:%g %p\n'

printf '\n--- Символические ссылки: проверить цели отдельно ---\n'
sudo find "$ETC_DIR" "$SHARE_DIR" \
    -type l -printf '%p -> %l\n'
# ВАЖНО: приватный ключ по отдельному требованию должен иметь 400.
# Не надо менять его на 644 ради общей проверки.

section "12. PID-файл: root, права 644"
show_cfg '^[[:space:]]*pid[[:space:]]'
printf '%s\n' "$BUILD" |
    grep -oE -- '--pid-path=[^[:space:]]+' || true
sudo stat -Lc '%n | owner=%U | group=%G | mode=%a' "$PID_FILE"
# Если фактический путь другой — исправь PID_FILE в начале.

section "13. Core dumps: working_directory, владелец, группа, ограничения"
show_cfg '^[[:space:]]*(working_directory|worker_rlimit_core)[[:space:]]'
if [[ -n "$CORE_DIR" ]]; then
    sudo stat -Lc '%n | type=%F | owner=%U | group=%G | mode=%a' "$CORE_DIR"
else
    printf '%s\n' "CORE_DIR не задан: путь нужно взять из working_directory."
fi
printf '\n--- Настройки ядра ---\n'
sysctl kernel.core_pattern fs.suid_dumpable 2>/dev/null || true
printf '\n--- Лимиты работающих Nginx-процессов ---\n'
for pid in $(pgrep -x nginx); do
    printf '\nPID %s\n' "$pid"
    sudo grep -E '^Max core file size' "/proc/$pid/limits" || true
done
# Права 660 для КАТАЛОГА из требования спорны:
# без x каталог нельзя нормально обходить.
# Отсутствие working_directory само по себе не доказывает запрет дампов.

section "14. keepalive_timeout: 0 < значение < 10 секунд"
show_cfg '^[[:space:]]*keepalive_timeout[[:space:]]'

section "15. send_timeout: 0 < значение < 10 секунд"
show_cfg '^[[:space:]]*send_timeout[[:space:]]'

section "16. server_tokens off"
show_cfg '^[[:space:]]*server_tokens[[:space:]]'
show_response_headers

section "17. Персонализированные index и error-страницы"
show_cfg '^[[:space:]]*(root|alias|index|error_page)[[:space:]]'
if [[ "$HTTP_READY" == 1 ]]; then
    for path in "$ERROR_PATH" "$INDEX_PATH"; do
        printf '\n--- GET %s: заголовки и первые 40 строк ---\n' "$path"
        curl "${CURL_ARGS[@]}" -D - "${BASE_URL}${path}" |
            awk 'NR <= 40 {print}'
    done
else
    printf '%s\n' "[HTTP-проверка пропущена]"
fi
# Просмотреть тело и убедиться, что нет стандартной страницы Nginx.
# Проверить все используемые виртуальные хосты и типовые ошибки.

section "18. Запрет скрытых файлов/директорий, недоступность .htpasswd"
show_cfg '^[[:space:]]*location[[:space:]]'
printf '\n--- Контекст правил доступа ---\n'
printf '%s\n' "$CFG" |
    grep -nE -A 8 '^[[:space:]]*location[[:space:]]' || true
if [[ "$HTTP_READY" == 1 ]]; then
    printf '\n--- GET %s ---\n' "$HIDDEN_PATH"
    curl "${CURL_ARGS[@]}" -D - -o /dev/null \
        "${BASE_URL}${HIDDEN_PATH}"
fi
# 403/404 — ожидаемые коды, но необходимо также проверить правила:
# ответ SPA с кодом 200 сам по себе не доказывает утечку файла.
# Эта проверка намеренно НЕ выводит потенциальное содержимое .htpasswd.

section "19. proxy_hide_header и фактические заголовки ответа"
show_cfg '^[[:space:]]*(proxy_hide_header|proxy_pass_header)[[:space:]]'
show_response_headers
# Проверить X-Powered-By, Server, X-Pad, X-Accel-*.
# В исходном требовании, вероятно, опечатка Data вместо Date.
# proxy_hide_header Server скрывает заголовок upstream,
# но не собственный Server, формируемый Nginx.

section "20. log_format и соответствие записей access/error"
printf '%s\n' "$CFG" |
    grep -nE -A 12 '^[[:space:]]*log_format[[:space:]]' || true
show_cfg '^[[:space:]]*(access_log|error_log)[[:space:]]'
printf '\n--- Access log: последние 20 строк ---\n'
sudo tail -n 20 "$ACCESS_LOG"
printf '\n--- Error log: последние 20 строк ---\n'
sudo tail -n 20 "$ERROR_LOG"
# Проверить переменные:
# $remote_addr $remote_user $time_local $request $status
# $body_bytes_sent $http_referer $http_user_agent
# $proxy_host $upstream_addr
# Формат log_format относится к access_log, не к error_log.

section "21. Logrotate: daily, rotate 90, фактический путь журналов"
sudo cat "$LOGROTATE_FILE"
printf '\n--- Другие файлы logrotate с упоминанием nginx/httpdnginx ---\n'
sudo grep -RnlE 'nginx|httpdnginx' /etc/logrotate.conf /etc/logrotate.d \
    2>/dev/null || true
printf '\n--- Планирование logrotate ---\n'
systemctl list-timers --all --no-pager | grep -i logrotate || true
ls -l /etc/cron.daily/logrotate 2>/dev/null || true

section "22. error_log в syslog и поступление сообщений"
show_cfg '^[[:space:]]*error_log[[:space:]]'
printf '\n--- Последние сообщения с метками nginx/gpn ---\n'
sudo journalctl -t nginx -t gpn --since "30 minutes ago" \
    -n 50 --no-pager
printf '\n--- Приём syslog UDP/TCP 514 ---\n'
sudo ss -lunp | grep -E ':514[[:space:]]' || true
sudo ss -ltnp | grep -E ':514[[:space:]]' || true
printf '\n--- Правила системного логгера ---\n'
sudo grep -RniE 'nginx|gpn|imudp|514|local[0-7]' \
    /etc/rsyslog.conf /etc/rsyslog.d /etc/syslog-ng \
    2>/dev/null || true
# Пустой journalctl не доказывает отсутствие доставки:
# syslog может направлять сообщения в другие файлы/на другой сервер.

section "23. access_log в syslog и поступление сообщений"
show_cfg '^[[:space:]]*access_log[[:space:]]'
sudo journalctl -t gpn -t nginx --since "30 minutes ago" \
    -n 50 --no-pager
# Проверить на реальном получателе события, возникшие от GET-проверок.
# Access log — журнал запросов, не самостоятельное доказательство
# регистрации всех событий авторизации приложения.

section "24. Передача IP источника через proxy_set_header"
show_cfg '^[[:space:]]*proxy_set_header[[:space:]]'
# Ожидается:
# proxy_set_header X-Real-IP $remote_addr;
# proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
# Проверить применение для каждого нужного proxy location.

section "25. В конфигурации только HTTPS-порт 443"
show_cfg '^[[:space:]]*listen[[:space:]]'
# Для HTTP-модуля TLS обычно обозначается: listen 443 ssl;
# Номер 443 сам по себе не включает TLS.

section "26. Сертификат: издатель, сроки, SAN, доверие корпоративному УЦ"
show_cfg '^[[:space:]]*ssl_certificate[[:space:]]'
sudo openssl x509 -in "$CERT_FILE" -noout \
    -subject -issuer -serial -dates -ext subjectAltName

printf '\n--- Сертификат не истёк: exit=0 означает успех ---\n'
sudo openssl x509 -in "$CERT_FILE" -noout -checkend 0

if [[ -n "$CA_FILE" ]]; then
    VERIFY_ARGS=(-CAfile "$CA_FILE" -purpose sslserver)
    if [[ -n "$CHAIN_FILE" ]]; then
        VERIFY_ARGS+=(-untrusted "$CHAIN_FILE")
    fi
    if [[ -n "$HOST" ]]; then
        VERIFY_ARGS+=(-verify_hostname "$HOST")
    fi
    sudo openssl verify "${VERIFY_ARGS[@]}" "$CERT_FILE"
else
    printf '%s\n' \
      "CA_FILE не задан: доверие корпоративному УЦ не проверено." \
      "Одного текста issuer недостаточно для подтверждения доверия."
fi
# Если ssl_certificate несколько — повторить для каждого файла.

section "27. Приватный ключ: права 400"
show_cfg '^[[:space:]]*ssl_certificate_key[[:space:]]'
sudo stat -Lc '%n | owner=%U | group=%G | mode=%a' "$KEY_FILE"
# Содержимое приватного ключа НЕ выводится.

section "28. Протоколы: только TLSv1.2 и TLSv1.3"
show_cfg '^[[:space:]]*ssl_protocols[[:space:]]'
# Синтаксис Nginx:
# ssl_protocols TLSv1.2 TLSv1.3;
# Вариант "-all +TLSv1.2 +TLSv1.3" не является синтаксисом Nginx.

section "29. ssl_prefer_server_ciphers и ssl_ciphers"
show_cfg '^[[:space:]]*(ssl_prefer_server_ciphers|ssl_ciphers|ssl_conf_command)[[:space:]]'
# Ожидается ssl_prefer_server_ciphers on;
# Состав шифров сравнить с утверждённой политикой.
# Настройку TLS 1.3 нельзя оценить только по ssl_ciphers.

section "30. DH-параметры: путь, размер не менее 2048 бит, права 400"
show_cfg '^[[:space:]]*ssl_dhparam[[:space:]]'
sudo openssl dhparam -in "$DH_FILE" -text -noout
sudo stat -Lc '%n | owner=%U | group=%G | mode=%a' "$DH_FILE"
# Это публичные DH-параметры, а не приватный ключ.
# Директива используется для DHE-шифров.

section "31. HSTS: max-age=15768000; includeSubDomains; always"
show_cfg '^[[:space:]]*add_header[[:space:]]+Strict-Transport-Security[[:space:]]'
show_response_headers

section "32. OCSP Stapling: ssl_stapling on; ssl_stapling_verify on"
show_cfg '^[[:space:]]*(ssl_stapling|ssl_stapling_verify|ssl_trusted_certificate|resolver)[[:space:]]'
if [[ "$HTTP_READY" == 1 ]]; then
    CONNECT_HOST="${TARGET_IP:-$HOST}"
    printf '\n--- Фактический OCSP Stapling ---\n'
    timeout 15 openssl s_client \
        -connect "${CONNECT_HOST}:${HTTPS_PORT}" \
        -servername "$HOST" -status </dev/null 2>&1 |
        awk '
          /OCSP response:/ {print}
          /OCSP Response Status:/ {print}
          /Cert Status:/ {print}
          /This Update:/ {print}
          /Next Update:/ {print}
        '
fi
# Здесь s_client используется для просмотра stapling,
# не как замена проверки доверия в пункте 26.

section "33. ssl_session_tickets off"
show_cfg '^[[:space:]]*ssl_session_tickets[[:space:]]'

section "34. Ограничение методов: limit_except в каждом нужном location"
printf '%s\n' "$CFG" |
    grep -nE -A 10 '^[[:space:]]*(location|limit_except)[[:space:]]' || true
# GET в limit_except также разрешает HEAD.
# Автоматические POST/PUT/DELETE здесь НЕ выполняются:
# при ошибочной конфигурации они могут изменить данные.
#
# Только для согласованного тестового URI, после отдельного разрешения:
# curl --cacert /path/to/ca.pem -i -X POST \
#   "https://your-host/approved-test-only-uri"
#
# Проверить, что запрещённый метод отклонён именно правилом Nginx,
# а не только приложением.

section "35. Фактически открытые порты Nginx"
sudo ss -lntup | grep -i nginx || true
# Для требования "только HTTPS" сверить все TCP/UDP-сокеты,
# включая IPv6. При наличии HTTP/3 возможен UDP 443.

section "36. client_header_timeout и client_body_timeout: 10 секунд"
show_cfg '^[[:space:]]*(client_header_timeout|client_body_timeout)[[:space:]]'

section "37. client_max_body_size: 20m"
show_cfg '^[[:space:]]*client_max_body_size[[:space:]]'

section "38. large_client_header_buffers: 16 64k"
show_cfg '^[[:space:]]*large_client_header_buffers[[:space:]]'

section "39. Ограничение соединений: зона perip и limit_conn perip 10"
show_cfg '^[[:space:]]*(limit_conn_zone|limit_conn|limit_conn_dry_run|limit_conn_status)[[:space:]]'
# Ожидается:
# limit_conn_zone $binary_remote_addr zone=perip:10m;
# limit_conn perip 10;
# Проверить, что limit_conn_dry_run не включён.

section "40. Ограничение запросов: зона one, rate=10r/s и применение зоны"
show_cfg '^[[:space:]]*(limit_req_zone|limit_req|limit_req_dry_run|limit_req_status)[[:space:]]'
# Ожидается:
# limit_req_zone $binary_remote_addr zone=one:10m rate=10r/s;
# Дополнительно обязательно применение: limit_req zone=one ...;
# Одна директива limit_req_zone запросы НЕ ограничивает.
# Проверить, что limit_req_dry_run не включён.

section "41. X-Frame-Options: SAMEORIGIN"
show_cfg '^[[:space:]]*add_header[[:space:]]+X-Frame-Options[[:space:]]'
show_response_headers

section "42. X-Content-Type-Options: nosniff"
show_cfg '^[[:space:]]*add_header[[:space:]]+X-Content-Type-Options[[:space:]]'
show_response_headers

section '43. X-XSS-Protection: "1; mode=block" по вашему требованию'
show_cfg '^[[:space:]]*add_header[[:space:]]+X-XSS-Protection[[:space:]]'
show_response_headers

section "44. Content-Security-Policy"
show_cfg '^[[:space:]]*add_header[[:space:]]+Content-Security-Policy[[:space:]]'
show_response_headers
# Сравнить с согласованной политикой приложения.
# Если директива записана на нескольких строках —
# посмотреть полный блок конфигурации.

section "45. Referrer-Policy: no-referrer"
show_cfg '^[[:space:]]*add_header[[:space:]]+Referrer-Policy[[:space:]]'
show_response_headers

section "Завершено"
printf '%s\n' \
  "Это сбор свидетельств, а не автоматический сертификат соответствия." \
  "Проверить контексты http/server/location, наследование и все виртуальные хосты." \
  "Пустой результат поиска директивы может означать значение по умолчанию." \
  "HTTP-заголовки выше проверены для GET / выбранного HOST." \
  "Повторить проверки для других сервисов, значимых URI и ответов ошибок." \
  "Перед отправкой вывода скрыть секреты, внутренние адреса и чувствительные записи логов."
NGINX_AUDIT
