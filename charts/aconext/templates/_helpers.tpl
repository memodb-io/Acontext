{{/*
Expand the name of the chart.
*/}}
{{- define "aconext.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
We truncate at 63 chars because some Kubernetes name fields are limited to this (by the DNS naming spec).
If release name contains chart name it will be used as a full name.
*/}}
{{- define "aconext.fullname" -}}
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
Create chart name and version as used by the chart label.
*/}}
{{- define "aconext.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels
*/}}
{{- define "aconext.labels" -}}
helm.sh/chart: {{ include "aconext.chart" . }}
{{ include "aconext.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{/*
Selector labels
*/}}
{{- define "aconext.selectorLabels" -}}
app.kubernetes.io/name: {{ include "aconext.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
Create the name of the core service account to use
*/}}
{{- define "aconext.core.serviceAccountName" -}}
{{- if .Values.core.serviceAccount.create }}
{{- default (include "aconext.core.name" .) .Values.core.serviceAccount.name }}
{{- else }}
{{- default "default" .Values.core.serviceAccount.name }}
{{- end }}
{{- end }}

{{/*
Create the name of the api service account to use
*/}}
{{- define "aconext.api.serviceAccountName" -}}
{{- if .Values.api.serviceAccount.create }}
{{- default (include "aconext.api.name" .) .Values.api.serviceAccount.name }}
{{- else }}
{{- default "default" .Values.api.serviceAccount.name }}
{{- end }}
{{- end }}

{{/*
Core service name
*/}}
{{- define "aconext.core.name" -}}
{{- printf "%s-core" (include "aconext.fullname" .) | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
API service name
*/}}
{{- define "aconext.api.name" -}}
{{- printf "%s-api" (include "aconext.fullname" .) | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Core selector labels
*/}}
{{- define "aconext.core.selectorLabels" -}}
app.kubernetes.io/name: {{ include "aconext.name" . }}-core
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
API selector labels
*/}}
{{- define "aconext.api.selectorLabels" -}}
app.kubernetes.io/name: {{ include "aconext.name" . }}-api
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
Get PostgreSQL host
*/}}
{{- define "aconext.postgresql.host" -}}
{{- if .Values.postgresql.enabled }}
{{- printf "%s-postgresql" .Release.Name }}
{{- else }}
{{- .Values.external.postgresql.host }}
{{- end }}
{{- end }}

{{/*
Get PostgreSQL port
*/}}
{{- define "aconext.postgresql.port" -}}
{{- if .Values.postgresql.enabled }}
{{- "5432" }}
{{- else }}
{{- .Values.external.postgresql.port | default "5432" }}
{{- end }}
{{- end }}

{{/*
Get Redis host
*/}}
{{- define "aconext.redis.host" -}}
{{- if .Values.redis.enabled }}
{{- printf "%s-redis-master" .Release.Name }}
{{- else }}
{{- .Values.external.redis.host }}
{{- end }}
{{- end }}

{{/*
Get Redis port
*/}}
{{- define "aconext.redis.port" -}}
{{- if .Values.redis.enabled }}
{{- "6379" }}
{{- else }}
{{- .Values.external.redis.port | default "6379" }}
{{- end }}
{{- end }}

{{/*
Get RabbitMQ host
*/}}
{{- define "aconext.rabbitmq.host" -}}
{{- if .Values.rabbitmq.enabled }}
{{- printf "%s-rabbitmq" .Release.Name }}
{{- else }}
{{- .Values.external.rabbitmq.host }}
{{- end }}
{{- end }}

{{/*
Get RabbitMQ port
*/}}
{{- define "aconext.rabbitmq.port" -}}
{{- if .Values.rabbitmq.enabled }}
{{- "5672" }}
{{- else }}
{{- .Values.external.rabbitmq.port | default "5672" }}
{{- end }}
{{- end }}

{{/*
Get PostgreSQL database URL
*/}}
{{- define "aconext.postgresql.url" -}}
{{- $host := include "aconext.postgresql.host" . }}
{{- $port := include "aconext.postgresql.port" . }}
{{- $user := "" }}
{{- $password := "" }}
{{- $database := "" }}
{{- if .Values.postgresql.enabled }}
{{- $user = .Values.postgresql.auth.username }}
{{- $password = .Values.postgresql.auth.password }}
{{- $database = .Values.postgresql.auth.database }}
{{- else }}
{{- $user = .Values.external.postgresql.username }}
{{- $password = .Values.secrets.postgresql.password }}
{{- $database = .Values.external.postgresql.database }}
{{- end }}
{{- printf "postgresql://%s:%s@%s:%s/%s" $user $password $host $port $database }}
{{- end }}

{{/*
Get Redis URL
*/}}
{{- define "aconext.redis.url" -}}
{{- $host := include "aconext.redis.host" . }}
{{- $port := include "aconext.redis.port" . }}
{{- $password := "" }}
{{- if .Values.redis.enabled }}
{{- $password = .Values.redis.auth.password }}
{{- else }}
{{- $password = .Values.secrets.redis.password }}
{{- end }}
{{- if $password }}
{{- printf "rediss://:%s@%s:%s" $password $host $port }}
{{- else }}
{{- printf "redis://%s:%s" $host $port }}
{{- end }}
{{- end }}

{{/*
Get RabbitMQ URL
*/}}
{{- define "aconext.rabbitmq.url" -}}
{{- $host := include "aconext.rabbitmq.host" . }}
{{- $port := include "aconext.rabbitmq.port" . }}
{{- $user := "" }}
{{- $password := "" }}
{{- $vhost := "" }}
{{- if .Values.rabbitmq.enabled }}
{{- $user = .Values.rabbitmq.auth.username }}
{{- $password = .Values.rabbitmq.auth.password }}
{{- $vhost = .Values.rabbitmq.auth.vhost | default "/" }}
{{- else }}
{{- $user = .Values.external.rabbitmq.username }}
{{- $password = .Values.secrets.rabbitmq.password }}
{{- $vhost = .Values.external.rabbitmq.vhost | default "/" }}
{{- end }}
{{- printf "amqps://%s:%s@%s:%s%s" $user $password $host $port $vhost }}
{{- end }}

{{/*
Generate env entries from core.env
*/}}
{{- define "aconext.core.env" -}}
{{- range $key, $value := .Values.core.env }}
- name: {{ $key }}
  value: {{ $value | quote }}
{{- end }}
{{- end }}

{{/*
Generate env entries from api.env
*/}}
{{- define "aconext.api.env" -}}
{{- range $key, $value := .Values.api.env }}
- name: {{ $key }}
  value: {{ $value | quote }}
{{- end }}
{{- end }}
