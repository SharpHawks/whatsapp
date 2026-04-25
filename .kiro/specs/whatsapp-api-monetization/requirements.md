# Requirements Document

## Introduction

WhatsApp API Monetization Platform - это сервис, который позволяет пользователям создавать и управлять WhatsApp ботами через API для автоматизации бизнес-коммуникаций и генерации дохода. Платформа предоставляет инструменты для отправки сообщений, управления диалогами, интеграции с платежными системами и монетизации через подписки и pay-per-use модели.

## Glossary

- **Platform**: WhatsApp API Monetization Platform - основная система
- **User**: Пользователь платформы, который создает и управляет ботами
- **Bot**: Автоматизированный агент WhatsApp, созданный пользователем
- **Client**: Конечный пользователь, который взаимодействует с ботом через WhatsApp
- **API Key**: Уникальный ключ для аутентификации API запросов
- **Message**: Текстовое, медиа или интерактивное сообщение WhatsApp
- **Webhook**: HTTP endpoint для получения входящих событий
- **Balance**: Баланс счета пользователя в системе
- **Transaction**: Финансовая операция (пополнение, списание, вывод средств)

## Requirements

### Requirement 1

**User Story:** Как пользователь, я хочу зарегистрироваться в платформе и получить API ключ, чтобы начать использовать WhatsApp API

#### Acceptance Criteria

1. WHEN User submits registration form with email and password, THE Platform SHALL create new account with unique identifier
2. WHEN User completes email verification, THE Platform SHALL generate API key for the account
3. THE Platform SHALL store API key in encrypted format in database
4. WHEN User requests API key display, THE Platform SHALL show the key in user dashboard
5. THE Platform SHALL provide API key regeneration functionality with confirmation step

### Requirement 2

**User Story:** Как пользователь, я хочу отправлять WhatsApp сообщения через API, чтобы автоматизировать коммуникацию с клиентами

#### Acceptance Criteria

1. WHEN User sends POST request to /api/messages endpoint with valid API key, THE Platform SHALL authenticate the request
2. WHEN authenticated request contains recipient phone number and message content, THE Platform SHALL validate phone number format
3. WHEN validation passes, THE Platform SHALL queue message for delivery through WhatsApp Business API
4. THE Platform SHALL return message ID and status in API response within 2 seconds
5. WHEN message delivery status changes, THE Platform SHALL send webhook notification to User's configured endpoint

### Requirement 3

**User Story:** Как пользователь, я хочу получать входящие сообщения от клиентов через webhook, чтобы обрабатывать их в моем приложении

#### Acceptance Criteria

1. THE Platform SHALL allow User to configure webhook URL in account settings
2. WHEN Client sends message to Bot, THE Platform SHALL receive the message from WhatsApp
3. WHEN incoming message is received, THE Platform SHALL send HTTP POST request to User's webhook URL within 1 second
4. THE Platform SHALL include message content, sender phone number, timestamp, and message ID in webhook payload
5. WHEN webhook endpoint returns non-200 status code, THE Platform SHALL retry delivery up to 3 times with exponential backoff

### Requirement 4

**User Story:** Как пользователь, я хочу управлять балансом счета и оплачивать использование API, чтобы монетизировать сервис

#### Acceptance Criteria

1. THE Platform SHALL create balance account for each User upon registration with initial value of zero
2. WHEN User sends message through API, THE Platform SHALL deduct cost from User balance before message delivery
3. WHEN User balance is insufficient for operation, THE Platform SHALL reject API request with error code 402
4. THE Platform SHALL provide balance top-up functionality through payment gateway integration
5. THE Platform SHALL display transaction history with timestamps, amounts, and operation types in user dashboard

### Requirement 5

**User Story:** Как пользователь, я хочу отправлять медиа файлы (изображения, документы, видео) через API, чтобы обогатить коммуникацию с клиентами

#### Acceptance Criteria

1. WHEN User uploads media file to /api/media endpoint, THE Platform SHALL validate file type and size limits
2. WHERE file size exceeds 16 MB, THE Platform SHALL reject upload with error message
3. WHEN validation passes, THE Platform SHALL store media file in cloud storage and return media ID
4. WHEN User sends message with media ID, THE Platform SHALL attach media file to WhatsApp message
5. THE Platform SHALL support image, video, audio, and document file types

### Requirement 6

**User Story:** Как пользователь, я хочу создавать интерактивные сообщения с кнопками, чтобы улучшить пользовательский опыт клиентов

#### Acceptance Criteria

1. THE Platform SHALL support button message type in API requests
2. WHEN User creates button message, THE Platform SHALL validate button count does not exceed 3 buttons
3. WHEN User defines button actions, THE Platform SHALL support reply and URL button types
4. WHEN Client clicks button, THE Platform SHALL send button click event to User webhook
5. THE Platform SHALL include button ID and payload in webhook notification

### Requirement 7

**User Story:** Как пользователь, я хочу просматривать статистику использования API, чтобы анализировать эффективность и затраты

#### Acceptance Criteria

1. THE Platform SHALL track message count, delivery rate, and costs for each User account
2. THE Platform SHALL provide API endpoint for retrieving statistics with date range filter
3. WHEN User requests statistics, THE Platform SHALL return data aggregated by day
4. THE Platform SHALL display statistics dashboard with charts for messages sent, delivery rate, and spending
5. THE Platform SHALL calculate and display average cost per message for selected period

### Requirement 8

**User Story:** Как пользователь, я хочу настроить автоматические ответы на ключевые слова, чтобы автоматизировать базовые взаимодействия

#### Acceptance Criteria

1. THE Platform SHALL provide interface for creating keyword-response rules
2. WHEN User creates rule with keyword and response text, THE Platform SHALL store rule in database
3. WHEN incoming message contains configured keyword, THE Platform SHALL match keyword case-insensitively
4. WHEN keyword match is found, THE Platform SHALL send configured response automatically within 2 seconds
5. THE Platform SHALL allow User to enable or disable auto-response functionality per Bot

### Requirement 9

**User Story:** Как пользователь, я хочу выводить заработанные средства на банковский счет, чтобы монетизировать свой сервис

#### Acceptance Criteria

1. THE Platform SHALL provide withdrawal request functionality in user dashboard
2. WHEN User submits withdrawal request, THE Platform SHALL validate minimum withdrawal amount of 100 euros
3. WHEN balance is sufficient, THE Platform SHALL create pending withdrawal transaction
4. THE Platform SHALL process withdrawal to User's configured SEPA bank account within 3 business days
5. WHEN withdrawal is completed, THE Platform SHALL send email notification to User

### Requirement 10

**User Story:** Как пользователь, я хочу управлять несколькими ботами под одним аккаунтом, чтобы разделять разные проекты

#### Acceptance Criteria

1. THE Platform SHALL allow User to create multiple Bot instances under single account
2. WHEN User creates new Bot, THE Platform SHALL generate unique Bot ID and separate API key
3. THE Platform SHALL track balance and statistics separately for each Bot
4. THE Platform SHALL provide Bot switching interface in user dashboard
5. THE Platform SHALL limit maximum number of Bots per User account to 10 instances
