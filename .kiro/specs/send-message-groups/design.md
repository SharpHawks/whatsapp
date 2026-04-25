# Design Document: Send Message to Groups

## Overview

Расширение страницы Send Message для поддержки отправки сообщений как в личные чаты, так и в группы WhatsApp. Реализация включает добавление вкладок для переключения режимов, загрузку списка групп через API, и отображение документации API.

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (React)                          │
│  ┌────────────────────────────────────────────────────────┐ │
│  │           SendMessagePage Component                     │ │
│  │  ┌──────────────┐  ┌──────────────┐                   │ │
│  │  │ Contact Tab  │  │  Group Tab   │                   │ │
│  │  └──────────────┘  └──────────────┘                   │ │
│  │  ┌──────────────────────────────────────────────────┐ │ │
│  │  │         Message Form (dynamic content)            │ │ │
│  │  └──────────────────────────────────────────────────┘ │ │
│  │  ┌──────────────────────────────────────────────────┐ │ │
│  │  │         API Documentation Section                 │ │ │
│  │  └──────────────────────────────────────────────────┘ │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ HTTP/REST API
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    Backend (Node.js/Express)                 │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  GET /api/v1/bots/:botId/groups                        │ │
│  │  POST /api/v1/messages/send (existing, enhanced)      │ │
│  └────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────┐ │
│  │         Worker Baileys Manager                          │ │
│  │  - getGroups(botId)                                    │ │
│  │  - sendMessage(to, content, type)                      │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ WhatsApp Web API
                            ▼
                    ┌───────────────┐
                    │   WhatsApp    │
                    └───────────────┘
```

## Components and Interfaces

### Frontend Components

#### 1. SendMessagePage (Updated)

**Location:** `frontend/src/pages/SendMessagePage.tsx`

**State:**
```typescript
const [activeTab, setActiveTab] = useState<'contact' | 'group'>('contact')
const [selectedBot, setSelectedBot] = useState<string>('')
const [recipient, setRecipient] = useState<string>('')
const [selectedGroup, setSelectedGroup] = useState<string>('')
const [message, setMessage] = useState<string>('')
const [groups, setGroups] = useState<Group[]>([])
const [isLoadingGroups, setIsLoadingGroups] = useState(false)
```

**Props:** None (page component)

**Key Methods:**
- `handleTabChange(tab: 'contact' | 'group')` - переключение вкладок
- `loadGroups(botId: string)` - загрузка списка групп
- `handleSendMessage()` - отправка сообщения
- `handleBotChange(botId: string)` - смена выбранного бота

#### 2. GroupSelector Component (New)

**Location:** `frontend/src/components/messages/GroupSelector.tsx`

**Props:**
```typescript
interface GroupSelectorProps {
  botId: string
  selectedGroup: string
  onGroupSelect: (groupId: string) => void
}
```

**Features:**
- Отображение списка групп с названиями
- Поиск по названию группы
- Отображение Group ID
- Loading state при загрузке

#### 3. ApiDocumentation Component (New)

**Location:** `frontend/src/components/messages/ApiDocumentation.tsx`

**Props:**
```typescript
interface ApiDocumentationProps {
  selectedBot?: string
}
```

**Features:**
- Примеры curl запросов для контактов
- Примеры curl запросов для групп
- Описание параметров
- Примеры ответов

### Backend Components

#### 1. Bot Routes (Enhanced)

**Location:** `src/routes/bot.routes.ts`

**New Endpoint:**
```typescript
GET /api/v1/bots/:botId/groups
```

**Request:**
- Headers: `Authorization: Bearer <JWT>`
- Params: `botId` (string)

**Response:**
```typescript
{
  groups: [
    {
      id: string,           // e.g., "123456789@g.us"
      name: string,         // e.g., "Family Group"
      participantCount: number,
      isAdmin: boolean
    }
  ]
}
```

**Error Responses:**
- 401: Unauthorized
- 403: Forbidden (not bot owner)
- 404: Bot not found
- 400: Bot not connected

#### 2. Worker Baileys Manager (Enhanced)

**Location:** `src/services/worker-baileys.manager.ts`

**New Method:**
```typescript
async getGroups(botId: string): Promise<Group[]>
```

**Implementation:**
- Получает socket connection для бота
- Вызывает `socket.groupFetchAllParticipating()`
- Форматирует данные групп
- Возвращает список групп

#### 3. Message Service (Enhanced)

**Location:** `src/services/message.service.ts`

**Enhanced Method:**
```typescript
async sendMessage(params: {
  botId: string,
  to: string,  // phone number or group ID
  type: 'text' | 'image' | 'document',
  content: any
}): Promise<Message>
```

**Changes:**
- Определение типа получателя (contact vs group)
- Валидация формата Group ID
- Поддержка отправки в группы

## Data Models

### Group Model (Frontend)

```typescript
interface Group {
  id: string              // WhatsApp group ID (e.g., "123456789@g.us")
  name: string            // Group name
  participantCount: number // Number of participants
  isAdmin: boolean        // Is bot admin in this group
}
```

### Message Model (Enhanced)

```typescript
interface Message {
  id: string
  botId: string
  to: string              // Can be phone number or group ID
  recipientType: 'contact' | 'group'  // NEW FIELD
  type: 'text' | 'image' | 'document'
  content: any
  status: 'pending' | 'sent' | 'delivered' | 'read' | 'failed'
  createdAt: string
  updatedAt: string
}
```

## API Endpoints

### Get Bot Groups

```
GET /api/v1/bots/:botId/groups
```

**Authentication:** JWT Required

**Response:**
```json
{
  "groups": [
    {
      "id": "123456789@g.us",
      "name": "Family Group",
      "participantCount": 15,
      "isAdmin": true
    }
  ]
}
```

### Send Message (Enhanced)

```
POST /api/v1/messages/send
```

**Request Body:**
```json
{
  "botId": "bot-uuid",
  "to": "123456789@g.us",  // or "+1234567890"
  "type": "text",
  "content": {
    "text": "Hello Group!"
  }
}
```

## UI/UX Design

### Tabs Layout

```
┌─────────────────────────────────────────────────────────┐
│  Send Message                                            │
├─────────────────────────────────────────────────────────┤
│  [Send to Contact] [Send to Group]  ← Tabs              │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  Select Bot: [Dropdown ▼]                               │
│                                                          │
│  ┌────────────────────────────────────────────────────┐ │
│  │  Content changes based on active tab               │ │
│  │                                                     │ │
│  │  Contact Tab:                                       │ │
│  │    Phone Number: [+1234567890]                     │ │
│  │                                                     │ │
│  │  Group Tab:                                         │ │
│  │    Select Group: [Dropdown with search ▼]          │ │
│  │    Group ID: 123456789@g.us                        │ │
│  └────────────────────────────────────────────────────┘ │
│                                                          │
│  Message: [Text area]                                   │
│                                                          │
│  [Send Message]                                         │
│                                                          │
├─────────────────────────────────────────────────────────┤
│  API Documentation                                       │
│  ┌────────────────────────────────────────────────────┐ │
│  │  Send to Contact:                                   │ │
│  │  curl -X POST ...                                   │ │
│  │                                                     │ │
│  │  Send to Group:                                     │ │
│  │  curl -X POST ...                                   │ │
│  └────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

## Error Handling

### Frontend

1. **No Bot Selected:**
   - Disable send button
   - Show message: "Please select a bot"

2. **No Groups Available:**
   - Show empty state: "No groups found. Make sure your bot is added to groups."

3. **Group Loading Error:**
   - Show error message
   - Provide retry button

4. **Send Message Error:**
   - Display error toast
   - Keep form data for retry

### Backend

1. **Bot Not Connected:**
   - Return 400 with message: "Bot is not connected"

2. **Invalid Group ID:**
   - Return 400 with message: "Invalid group ID format"

3. **Bot Not in Group:**
   - Return 403 with message: "Bot is not a member of this group"

## Testing Strategy

### Frontend Tests

1. **Component Tests:**
   - Tab switching functionality
   - Group selector rendering
   - API documentation display

2. **Integration Tests:**
   - Load groups on bot selection
   - Send message to contact
   - Send message to group

### Backend Tests

1. **Unit Tests:**
   - `getGroups()` method
   - Group ID validation
   - Message sending to groups

2. **API Tests:**
   - GET /bots/:botId/groups endpoint
   - POST /messages/send with group ID
   - Authentication and authorization

## Security Considerations

1. **Authorization:**
   - Verify user owns the bot before fetching groups
   - Verify user owns the bot before sending messages

2. **Validation:**
   - Validate group ID format
   - Sanitize group names
   - Rate limiting on message sending

3. **Privacy:**
   - Don't expose participant phone numbers
   - Only show groups where bot is a member

## Performance Considerations

1. **Caching:**
   - Cache group list for 5 minutes
   - Invalidate cache when bot reconnects

2. **Lazy Loading:**
   - Load groups only when "Group" tab is selected
   - Debounce group search

3. **Optimization:**
   - Limit group list to 100 groups
   - Paginate if more groups exist

## Migration Strategy

1. **Database:**
   - Add `recipient_type` column to messages table
   - Default existing messages to 'contact'

2. **API:**
   - Backward compatible - existing API continues to work
   - Auto-detect recipient type based on format

3. **Deployment:**
   - Deploy backend first
   - Deploy frontend after backend is stable
   - No downtime required
