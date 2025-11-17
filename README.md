{{ . }}

{resolved alertname=ssl_expiracy_alert (test), grafana_folder=System alerts, host=spb99-wdq-ap01t, instance=spb99-mnt-ap01t:10000, job=node-exporter, land=test, port=443, product=DWH, server=spb99-mnt-ap01t  2025-11-17 09:06:20 +0300 +0300 2025-11-17 14:34:20 +0300 +0300 https://SPB99-MNT-AP01T/grafana/v116/alerting/grafana/af4daitur8oaof/view?orgId=1 dc17a356c3ff3c8f https://SPB99-MNT-AP01T/grafana/v116/alerting/silence/new?alertmanager=grafana&matcher=alertname%3Dssl_expiracy_alert+%28test%29&matcher=grafana_folder%3DSystem+alerts&matcher=host%3Dspb99-wdq-ap01t&matcher=instance%3Dspb99-mnt-ap01t%3A10000&matcher=job%3Dnode-exporter&matcher=land%3Dtest&matcher=port%3D443&matcher=product%3DDWH&matcher=server%3Dspb99-mnt-ap01t&orgId=1 https://SPB99-MNT-AP01T/grafana/v116/d/dashboard_uid?from=1763355980000&orgId=1&to=1763379260000 https://SPB99-MNT-AP01T/grafana/v116/d/dashboard_uid?from=1763355980000&orgId=1&to=1763379260000&viewPanel=1 map[B:22 C:1] [ var='B' labels={__name__=go_threads, instance=host.docker.internal:3000, job=grafana} value=22 ], [ var='C' labels={__name__=go_threads, instance=host.docker.internal:3000, job=grafana} value=1 ]  }



Value: {{ template "__text_values_list.copy" . }}
Labels:
{{ range .Labels.SortedPairs }} - {{ .Name }} = {{ .Value }}
{{ end }}
{{ if gt (len .GeneratorURL) 0 }}Source: {{ .GeneratorURL }}
{{ end }}{{ if gt (len .SilenceURL) 0 }}Silence: {{ .SilenceURL }}
{{ end }}{{ if gt (len .DashboardURL) 0 }}Dashboard: {{ .DashboardURL }}
{{ end }}{{ if gt (len .PanelURL) 0 }}Panel: {{ .PanelURL }}
{{ end }}{{ end }}{{ end }}

{{ define "__text_values_list.copy" }}{{ if len .Values }}{{ $first := true }}
{{ range $refID, $value := .Values -}}
{{ if $first }}{{ $first = false }}{{ else }}, {{ end }}
{{ $refID }}={{ $value }}
{{ end -}}
{{ else }}[no value]{{ end }}{{ end }}




Value: 

B=22
, 
C=1

Labels:
 - alertname = ssl_expiracy_alert (test)
 - grafana_folder = System alerts
 - host = spb99-wdq-ap01t
 - instance = spb99-mnt-ap01t:10000
 - job = node-exporter
 - land = test
 - port = 443
 - product = DWH
 - server = spb99-mnt-ap01t

Source: https://SPB99-MNT-AP01T/grafana/v116/alerting/grafana/af4daitur8oaof/view?orgId=1
Silence: https://SPB99-MNT-AP01T/grafana/v116/alerting/silence/new?alertmanager=grafana&matcher=alertname%3Dssl_expiracy_alert+%28test%29&matcher=grafana_folder%3DSystem+alerts&matcher=host%3Dspb99-wdq-ap01t&matcher=instance%3Dspb99-mnt-ap01t%3A10000&matcher=job%3Dnode-exporter&matcher=land%3Dtest&matcher=port%3D443&matcher=product%3DDWH&matcher=server%3Dspb99-mnt-ap01t&orgId=1
Dashboard: https://SPB99-MNT-AP01T/grafana/v116/d/dashboard_uid?from=1763355980000&orgId=1&to=1763379260000
Panel: https://SPB99-MNT-AP01T/grafana/v116/d/dashboard_uid?from=1763355980000&orgId=1&to=1763379260000&viewPanel=1
























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
