{{/*
Expand the name of the chart.
*/}}
{{- define "qa-platform.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
*/}}
{{- define "qa-platform.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{/*
Chart label
*/}}
{{- define "qa-platform.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels
*/}}
{{- define "qa-platform.labels" -}}
helm.sh/chart: {{ include "qa-platform.chart" . }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
environment: {{ .Values.environment }}
{{- end }}

{{/*
Selector labels for a given component
Usage: {{ include "qa-platform.selectorLabels" (dict "name" "api-gateway" "root" .) }}
*/}}
{{- define "qa-platform.selectorLabels" -}}
app.kubernetes.io/name: {{ .name }}
app.kubernetes.io/instance: {{ .root.Release.Name }}
{{- end }}

{{/*
Image reference helper
Usage: {{ include "qa-platform.image" (dict "repo" "api-gateway" "tag" .Values.images.apiGateway.tag "root" .) }}
*/}}
{{- define "qa-platform.image" -}}
{{ .root.Values.global.imageRegistry }}/{{ .repo }}:{{ .tag | default "latest" }}
{{- end }}

{{/*
EnvFrom secret ref — all services mount the same secret
*/}}
{{- define "qa-platform.envFrom" -}}
- secretRef:
    name: {{ .Values.apiGateway.existingSecret }}
{{- end }}
