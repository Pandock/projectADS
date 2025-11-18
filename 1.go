{{/*
  Grafana Notification Template Group: System alerts (email)
  Usage:
    - Alerting → Notification templates → New → paste this whole file.
    - In your Email contact point set:
        Subject: {{ template "email.subject" . }}
        Message: {{ template "email.message" . }}
    - Route only your system alerts (e.g., label alert_kind=sys_alert OR sys_alert=true)
      to this contact point via Notification policies, so other alerts remain unchanged.
*/}}

{{ define "email.subject" }}
  {{- $f := len .Alerts.Firing -}}
  {{- $r := len .Alerts.Resolved -}}
  [{{ .Status | toUpper }}] {{ or .Title .CommonLabels.alertname }}{{ if gt $f 0 }} ({{ $f }} firing){{ end }}{{ if gt $r 0 }} ({{ $r }} resolved){{ end }}
{{ end }}

{{ define "email.message" }}
{{- /* Detect a "system" alert by label. Customize if you use another label. */ -}}
{{- $isSys := or (eq (index .CommonLabels "sys_alert") "true") (eq (index .CommonLabels "alert_kind") "sys_alert") -}}
{{- $firing := .Alerts.Firing -}}
{{- $resolved := .Alerts.Resolved -}}
<!doctype html>
<html lang="ru">
  <head>
    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8"/>
    <meta name="viewport" content="width=device-width, initial-scale=1"/>
    <title>{{ template "email.subject" . }}</title>
    <style>
      body { font-family: Inter, Helvetica, Arial, sans-serif; color:#111827; margin:0; padding:0; background:#f5f6f8; }
      .container { max-width: 600px; margin: 0 auto; background:#ffffff; border:1px solid #E5E7EB; border-radius:6px; }
      .header { padding:16px 20px; border-bottom:1px solid #E5E7EB; }
      .title { font-size:18px; font-weight:600; margin:0 0 8px 0; }
      .chips { display:flex; gap:8px; align-items:center; flex-wrap:wrap; }
      .chip { display:inline-block; padding:2px 8px; border-radius:4px; font-size:12px; line-height:18px; }
      .chip-red { background:#FEE2E2; color:#991B1B; }
      .chip-green { background:#DCFCE7; color:#065F46; }
      .chip-blue { background:#DBEAFE; color:#1E40AF; text-decoration:none; }
      .section { padding:16px 20px; }
      .card { border:1px solid #E5E7EB; border-radius:6px; margin:12px 0; overflow:hidden; }
      .card-hd { padding:12px 16px; background:#F9FAFB; border-bottom:1px solid #E5E7EB; display:flex; justify-content:space-between; align-items:center; }
      .card-ttl { font-size:14px; font-weight:600; margin:0; }
      .card-bd { padding:14px 16px; font-size:13px; line-height:1.45; color:#1F2937; }
      .kv { width:100%; border-collapse:collapse; margin-top:8px; }
      .kv td { padding:4px 6px; border-bottom:1px solid #F3F4F6; vertical-align:top; font-size:13px; }
      .kv td.k { color:#6B7280; width:32%; }
      .btnrow { padding:12px 16px; border-top:1px solid #E5E7EB; }
      .btn { display:inline-block; margin-right:8px; padding:6px 10px; background:#2563EB; color:#fff !important; text-decoration:none; border-radius:4px; font-size:13px; }
      .muted { color:#6B7280; font-size:12px; margin-top:8px; }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <div class="title">{{ or .Title .CommonLabels.alertname }}</div>
        <div class="chips">
          {{- if gt (len $firing) 0 }}<span class="chip chip-red">{{ len $firing }} Firing</span>{{ end -}}
          {{- if gt (len $resolved) 0 }}<span class="chip chip-green">{{ len $resolved }} Resolved</span>{{ end -}}
          {{- if .GeneratorURL }}<a class="chip chip-blue" href="{{ .GeneratorURL }}" target="_blank" rel="noopener">View alert</a>{{ end -}}
        </div>
      </div>

      <div class="section">
        {{ if gt (len $firing) 0 }}
        {{ range $i, $a := $firing }}
        <div class="card">
          <div class="card-hd">
            <div class="card-ttl">{{ or $a.Labels.alertname $.CommonLabels.alertname }} (instance {{ or $a.Labels.instance "-" }})</div>
          </div>
          <div class="card-bd">
            {{ if $isSys }}
              <p>На сервере {{ or (index $a.Labels "host") (index $.CommonLabels "host") "—" }} истекает сертификат.<br/>
              Осталось дней — {{ with (index $a.Values "A") }}{{ .Value }}{{ else }}N/A{{ end }}.<br/>
              Продукт — {{ or (index $a.Labels "product") (index $.CommonLabels "product") "N/A" }}.</p>
            {{ else }}
              {{/* Non-system fallback: concise default info including Values */}}
              {{ if $a.Values }}
                <p><strong>Values</strong></p>
                <table class="kv">
                  {{ range $ref, $val := $a.Values }}
                  <tr><td class="k">{{ $ref }}</td><td>{{ $val.Value }}</td></tr>
                  {{ end }}
                </table>
              {{ end }}
            {{ end }}

            <p style="margin-top:10px;"><strong>Labels</strong></p>
            <table class="kv">
              {{ range $k, $v := $a.Labels }}
              <tr><td class="k">{{ $k }}</td><td>{{ $v }}</td></tr>
              {{ end }}
            </table>
          </div>
          <div class="btnrow">
            {{ if $a.SilenceURL }}<a class="btn" href="{{ $a.SilenceURL }}" target="_blank" rel="noopener">Silence</a>{{ end }}
            {{ if $a.DashboardURL }}<a class="btn" href="{{ $a.DashboardURL }}" target="_blank" rel="noopener">View dashboard</a>{{ end }}
            {{ if $a.PanelURL }}<a class="btn" href="{{ $a.PanelURL }}" target="_blank" rel="noopener">View panel</a>{{ end }}
          </div>
        </div>
        {{ end }}
        {{ end }}

        {{ if gt (len $resolved) 0 }}
        <div class="muted">Resolved: {{ len $resolved }}.</div>
        {{ end }}
      </div>
    </div>
  </body>
</html>
{{ end }}

