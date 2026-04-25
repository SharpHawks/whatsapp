# Requirements Document

## Introduction

Данная спецификация описывает рефакторинг архитектуры управления WhatsApp подключениями в платформе WhatsApp API. Текущая проблема заключается в том, что два процесса (main API и worker) пытаются управлять одними и теми же WhatsApp подключениями, что приводит к невозможности отправки сообщений. Решение предполагает централизацию всех WhatsApp подключений в worker процессе с использованием Redis для координации между процессами.

## Glossary

- **Main API Process**: Основной Express.js сервер, обрабатывающий HTTP/WebSocket запросы от frontend
- **Worker Process**: Отдельный Node.js процесс, обрабатывающий очередь сообщений из RabbitMQ
- **Baileys Connection**: WhatsApp Web подключение через библиотеку Baileys
- **Bot**: Экземпляр WhatsApp аккаунта, управляемый платформой
- **QR Code**: QR код для аутентификации WhatsApp Web
- **Redis PubSub**: Механизм публикации/подписки в Redis для межпроцессного взаимодействия
- **Connection State**: Состояние WhatsApp подключения (connecting, connected, disconnected, qr_required)

## Requirements

### Requirement 1

**User Story:** Как пользователь, я хочу подключить бота через frontend интерфейс, чтобы начать отправлять сообщения через WhatsApp

#### Acceptance Criteria

1. WHEN пользователь нажимает кнопку "Connect" в frontend, THE Main API Process SHALL обновить статус бота в базе данных на `connecting`
2. WHEN статус бота обновлен на `connecting`, THE Main API Process SHALL опубликовать событие `bot:connect` в Redis PubSub с идентификатором бота
3. WHEN Worker Process получает событие `bot:connect`, THE Worker Process SHALL создать новое Baileys Connection для указанного бота
4. IF создание подключения требует QR Code, THEN THE Worker Process SHALL сохранить QR Code в Redis с ключом `qr:{botId}` и временем жизни 60 секунд
5. WHEN QR Code сохранен в Redis, THE Worker Process SHALL опубликовать событие `qr:generated` в Redis PubSub с идентификатором бота

### Requirement 2

**User Story:** Как пользователь, я хочу видеть QR код в frontend интерфейсе, чтобы отсканировать его и завершить подключение бота

#### Acceptance Criteria

1. WHEN Main API Process получает запрос GET `/api/v1/bots/:botId/qr`, THE Main API Process SHALL получить QR Code из Redis по ключу `qr:{botId}`
2. IF QR Code существует в Redis, THEN THE Main API Process SHALL вернуть QR Code в формате base64 с HTTP статусом 200
3. IF QR Code не существует в Redis, THEN THE Main API Process SHALL вернуть HTTP статус 404 с сообщением "QR code not available"
4. WHEN frontend получает событие `qr:generated` через WebSocket, THE Main API Process SHALL отправить WebSocket сообщение клиенту с типом `qr_code` и идентификатором бота
5. WHEN пользователь сканирует QR Code, THE Worker Process SHALL обновить статус бота в базе данных на `connected`

### Requirement 3

**User Story:** Как пользователь, я хочу отправлять сообщения через подключенного бота, чтобы коммуницировать с клиентами через WhatsApp

#### Acceptance Criteria

1. WHEN пользователь отправляет сообщение через API, THE Main API Process SHALL добавить сообщение в очередь RabbitMQ
2. WHEN Worker Process получает сообщение из очереди, THE Worker Process SHALL найти активное Baileys Connection для указанного бота
3. IF активное подключение существует, THEN THE Worker Process SHALL отправить сообщение через Baileys Connection
4. IF активное подключение не существует, THEN THE Worker Process SHALL вернуть сообщение в очередь с задержкой 5 секунд и увеличить счетчик попыток
5. IF счетчик попыток превышает 3, THEN THE Worker Process SHALL переместить сообщение в dead letter queue и обновить статус сообщения на `failed`

### Requirement 4

**User Story:** Как пользователь, я хочу отключить бота через frontend интерфейс, чтобы остановить обработку сообщений

#### Acceptance Criteria

1. WHEN пользователь нажимает кнопку "Disconnect" в frontend, THE Main API Process SHALL опубликовать событие `bot:disconnect` в Redis PubSub с идентификатором бота
2. WHEN Worker Process получает событие `bot:disconnect`, THE Worker Process SHALL закрыть Baileys Connection для указанного бота
3. WHEN подключение закрыто, THE Worker Process SHALL обновить статус бота в базе данных на `disconnected`
4. WHEN статус обновлен, THE Worker Process SHALL опубликовать событие `bot:disconnected` в Redis PubSub с идентификатором бота
5. WHEN Main API Process получает событие `bot:disconnected`, THE Main API Process SHALL отправить WebSocket уведомление клиенту об отключении бота

### Requirement 5

**User Story:** Как администратор, я хочу видеть статус всех worker подключений в admin панели, чтобы мониторить работу системы

#### Acceptance Criteria

1. WHEN Worker Process запускается, THE Worker Process SHALL опубликовать событие `worker:started` в Redis PubSub с идентификатором worker процесса
2. WHILE Worker Process работает, THE Worker Process SHALL обновлять heartbeat в Redis каждые 10 секунд с ключом `worker:{workerId}:heartbeat`
3. WHEN Main API Process получает запрос GET `/api/v1/admin/workers`, THE Main API Process SHALL получить список всех worker heartbeat записей из Redis
4. THE Main API Process SHALL вернуть список активных workers с временем последнего heartbeat и количеством управляемых подключений
5. IF heartbeat worker не обновлялся более 30 секунд, THEN THE Main API Process SHALL пометить worker как `inactive` в ответе

### Requirement 6

**User Story:** Как разработчик, я хочу чтобы Worker Process автоматически восстанавливал подключения при перезапуске, чтобы минимизировать downtime

#### Acceptance Criteria

1. WHEN Worker Process запускается, THE Worker Process SHALL получить список всех ботов со статусом `connected` из базы данных
2. THE Worker Process SHALL создать Baileys Connection для каждого бота со статусом `connected`
3. IF создание подключения не удается, THEN THE Worker Process SHALL обновить статус бота на `disconnected` и записать ошибку в лог
4. WHEN все подключения восстановлены, THE Worker Process SHALL опубликовать событие `worker:ready` в Redis PubSub
5. THE Worker Process SHALL записать в лог количество успешно восстановленных подключений

### Requirement 7

**User Story:** Как разработчик, я хочу чтобы система корректно обрабатывала неожиданные отключения WhatsApp, чтобы пользователи были уведомлены о проблемах

#### Acceptance Criteria

1. WHEN Baileys Connection неожиданно закрывается, THE Worker Process SHALL обновить статус бота в базе данных на `disconnected`
2. THE Worker Process SHALL опубликовать событие `bot:connection_lost` в Redis PubSub с идентификатором бота и причиной отключения
3. WHEN Main API Process получает событие `bot:connection_lost`, THE Main API Process SHALL отправить WebSocket уведомление клиенту с типом `error`
4. THE Worker Process SHALL записать в лог детали отключения включая stack trace если доступен
5. THE Worker Process SHALL удалить QR Code из Redis если он существует для данного бота
