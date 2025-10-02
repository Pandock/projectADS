# 1) Старт запроса
resp="$(curl -sS -X POST "${TRINO_URL}/v1/statement" \
  -H "Authorization: Bearer ${JWT_TOKEN}" \
  -H "X-Trino-User: ${TRINO_USER}" \
  -H "X-Trino-Catalog: ${TRINO_CATALOG}" \
  -H "X-Trino-Schema: ${TRINO_SCHEMA}" \
  --data-binary "${SQL}")"

# 2) Печатаем данные из первой порции (если есть) и идём по nextUri
print_data() {
  echo "$1" | jq -r '
    if has("data") then
      .data[] | @tsv
    else empty end
  '
}

print_data "${resp}"
next="$(echo "${resp}" | jq -r '.nextUri // empty')"

# 3) Опрос nextUri до завершения
while [[ -n "${next}" ]]; do
  resp="$(curl -sS -X GET "${next}" -H "Authorization: Bearer ${JWT_TOKEN}")"
  print_data "${resp}"
  next="$(echo "${resp}" | jq -r '.nextUri // empty')"
done
