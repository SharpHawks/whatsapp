# Prometheus: настройка метрик

## Эндпоинты

| Сервис | URL | Описание |
|--------|-----|----------|
| API Server | `http://localhost:3000/metrics` | HTTP-метрики, сообщения (queued), подключения из БД |
| Worker | `http://localhost:3001/metrics` | Сообщения (sent/failed), активные подключения |

## Метрики

- `http_request_duration_seconds` — длительность HTTP-запросов (histogram)
- `whatsapp_messages_sent_total` — счётчик сообщений по type и status (queued/sent/failed)
- `whatsapp_active_connections` — количество активных WhatsApp-подключений
- `whatsapp_api_*` — стандартные метрики Node.js (память, CPU, event loop)

## Пример prometheus.yml

```yaml
scrape_configs:
  - job_name: 'whatsapp-api'
    static_configs:
      - targets: ['localhost:3000']
    metrics_path: /metrics

  - job_name: 'whatsapp-worker'
    static_configs:
      - targets: ['localhost:3001']
    metrics_path: /metrics
```

## Docker

Worker экспортирует порт 3001 для метрик. API — порт 3000.
