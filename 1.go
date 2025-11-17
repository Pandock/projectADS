`{{ define "plain.cert.message" -}}
{{ if gt (len .Alerts.Firing) 0 -}}
{{ range .Alerts.Firing -}}
Истекает сертификат на сервере {{ index .Labels "host" }}
{{- with (index .Values "B") }}
Осталось {{ printf "%.0f" . }} дня
{{- else }}
Осталось [нет значения]
{{- end }}
Продукт {{ index .Labels "product" }}
{{ if .DashboardURL }}Ссылка на дашборд: {{ .DashboardURL }}{{ end }}
{{ if .PanelURL }}Ссылка на панель: {{ .PanelURL }}{{ end }}

{{ end -}}
{{ end -}}

{{ if gt (len .Alerts.Resolved) 0 -}}
{{ range .Alerts.Resolved -}}
Проблема закрыта на сервере {{ index .Labels "host" }}
Продукт {{ index .Labels "product" }}
{{ if .DashboardURL }}Ссылка на дашборд: {{ .DashboardURL }}{{ end }}
{{ if .PanelURL }}Ссылка на панель: {{ .PanelURL }}{{ end }}

{{ end -}}
{{ end -}}
{{- end }}`
