# API Key Components Documentation

## Overview

This document describes the React components created for API key management in the WhatsApp API Platform frontend.

## Components

### 1. ApiKeyDisplay

**File:** `frontend/src/components/bots/ApiKeyDisplay.tsx`

**Purpose:** Displays an API key with copy functionality, visibility toggle, and expiration countdown.

**Props:**
```typescript
interface ApiKeyDisplayProps {
  apiKey: string          // The API key to display
  expiresAt?: string      // ISO timestamp when key expires
  onClose?: () => void    // Optional close handler
  showWarning?: boolean   // Show warning message (default: true)
}
```

**Features:**
- ✅ Display API key with copy button
- ✅ Toggle visibility (show/hide key)
- ✅ Copy to clipboard with visual feedback
- ✅ Warning message for one-time display
- ✅ Countdown timer showing time remaining
- ✅ Expiration information
- ✅ Clears key from memory on unmount
- ✅ Responsive design

**Usage Example:**
```tsx
import ApiKeyDisplay from '../components/bots/ApiKeyDisplay'

function MyComponent() {
  return (
    <ApiKeyDisplay
      apiKey="sk_1234567890abcdef..."
      expiresAt="2024-01-15T10:35:00Z"
      onClose={() => console.log('Closed')}
      showWarning={true}
    />
  )
}
```

**Visual States:**
1. **Warning Banner** - Yellow alert showing importance of saving key
2. **Key Display** - Monospace font with visibility toggle
3. **Copy Button** - Clipboard icon with success feedback
4. **Timer** - Live countdown showing time remaining
5. **Close Button** - "I've Saved the Key" confirmation

---

### 2. ApiKeyModal

**File:** `frontend/src/components/bots/ApiKeyModal.tsx`

**Purpose:** Modal dialog for password verification and API key reveal.

**Props:**
```typescript
interface ApiKeyModalProps {
  isOpen: boolean                                              // Modal visibility
  onClose: () => void                                          // Close handler
  botId: string                                                // Bot identifier
  botName: string                                              // Bot name for display
  onReveal: (password: string) => Promise<{                    // Reveal function
    key: string
    expiresAt: string
  }>
}
```

**Features:**
- ✅ Two-step flow: password input → key display
- ✅ Password input with show/hide toggle
- ✅ Form validation using react-hook-form + zod
- ✅ Error handling and display
- ✅ Loading states
- ✅ Security note for user awareness
- ✅ Integrates ApiKeyDisplay component
- ✅ Smooth transitions using Headless UI

**Usage Example:**
```tsx
import ApiKeyModal from '../components/bots/ApiKeyModal'
import { revealApiKey } from '../api/bots'

function MyComponent() {
  const [isOpen, setIsOpen] = useState(false)

  const handleReveal = async (password: string) => {
    const response = await revealApiKey(botId, password)
    return {
      key: response.key,
      expiresAt: response.expiresAt
    }
  }

  return (
    <>
      <button onClick={() => setIsOpen(true)}>
        View API Key
      </button>
      
      <ApiKeyModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        botId="bot-123"
        botName="My Bot"
        onReveal={handleReveal}
      />
    </>
  )
}
```

**Flow:**
1. **Step 1: Password Input**
   - User enters password
   - Show/hide password toggle
   - Validation on submit
   - Error display if verification fails

2. **Step 2: Key Display**
   - Shows ApiKeyDisplay component
   - User can copy key
   - Countdown timer
   - Close confirmation

---

## Integration with Backend

### API Endpoints Used

```typescript
// Reveal API key (requires password)
POST /api/v1/bots/:botId/api-key/reveal
Body: { password: string }
Response: { key: string, expiresAt: string }

// Get masked API key info
GET /api/v1/bots/:botId/api-key
Response: {
  id: string
  maskedKey: string
  botId: string
  isActive: boolean
  lastUsedAt: string | null
  createdAt: string
}

// Regenerate API key
POST /api/v1/bots/:botId/api-key/regenerate
Response: {
  message: string
  key: string
  expiresAt: string
}
```

### WebSocket Events

```typescript
// Listen for API key generation
socket.on('bot:apikey:generated', (data) => {
  // data: { botId, key, expiresAt, timestamp }
  showApiKeyModal(data)
})
```

---

## Styling

Both components use Tailwind CSS for styling and follow the existing design system:

**Colors:**
- Primary: Blue (buttons, links)
- Success: Green (copy confirmation)
- Warning: Yellow (important notices)
- Error: Red (error messages)
- Gray: Neutral (borders, backgrounds)

**Components:**
- Headless UI Dialog for modals
- Heroicons for icons
- Custom Button and Input components
- Responsive design (mobile-first)

---

## Security Features

### 1. Password Protection
- Password required to reveal key
- Show/hide toggle for password input
- No password stored in component state after submission

### 2. Memory Management
- API key cleared from memory on component unmount
- No key stored in localStorage or sessionStorage
- Temporary display only

### 3. Time-Limited Display
- Countdown timer shows expiration
- Visual warning about one-time display
- Clear messaging about regeneration

### 4. User Awareness
- Warning banners
- Security notes
- Clear instructions
- Expiration information

---

## Error Handling

### ApiKeyModal Errors

**Invalid Password:**
```
Error: "Invalid password"
Display: Red banner with error message
Action: User can retry
```

**Rate Limit Exceeded:**
```
Error: "Too many attempts. Please try again in 5 minutes."
Display: Red banner with error message
Action: Modal closes, user must wait
```

**Key Expired:**
```
Error: "API key can only be viewed once after generation. Please regenerate to view again."
Display: Red banner with error message
Action: User must regenerate key
```

**Network Error:**
```
Error: "Failed to reveal API key"
Display: Red banner with generic error
Action: User can retry
```

---

## Accessibility

### Keyboard Navigation
- ✅ Tab navigation through all interactive elements
- ✅ Enter to submit forms
- ✅ Escape to close modals
- ✅ Focus management

### Screen Readers
- ✅ Semantic HTML
- ✅ ARIA labels
- ✅ Alt text for icons
- ✅ Status announcements

### Visual
- ✅ High contrast colors
- ✅ Clear focus indicators
- ✅ Readable font sizes
- ✅ Icon + text labels

---

## Testing

### Manual Testing Checklist

**ApiKeyDisplay:**
- [ ] Key displays correctly
- [ ] Copy button works
- [ ] Visibility toggle works
- [ ] Timer counts down correctly
- [ ] Warning message shows
- [ ] Close button works
- [ ] Key clears on unmount

**ApiKeyModal:**
- [ ] Modal opens/closes correctly
- [ ] Password input works
- [ ] Show/hide password toggle works
- [ ] Form validation works
- [ ] Error messages display
- [ ] Loading state shows
- [ ] Success flow works
- [ ] ApiKeyDisplay integrates correctly

### Test Scenarios

**Scenario 1: Successful Key Reveal**
1. Click "View Full Key"
2. Enter correct password
3. Click "Show API Key"
4. Verify key displays
5. Copy key
6. Verify copy success
7. Close modal

**Scenario 2: Invalid Password**
1. Click "View Full Key"
2. Enter wrong password
3. Click "Show API Key"
4. Verify error message
5. Retry with correct password
6. Verify success

**Scenario 3: Expired Key**
1. Click "View Full Key"
2. Enter password
3. Receive "key expired" error
4. Close modal
5. Click "Regenerate Key"
6. Verify new key displays

---

## Future Enhancements

### Potential Improvements

1. **Biometric Authentication**
   - Use WebAuthn for password-less reveal
   - Fingerprint/Face ID support

2. **Key History**
   - Show previous keys (masked)
   - Revocation status
   - Usage statistics

3. **Advanced Copy Options**
   - Copy as environment variable
   - Copy as curl command
   - Copy with formatting

4. **Enhanced Security**
   - Two-factor authentication
   - IP whitelist display
   - Usage alerts

5. **Better UX**
   - Animated transitions
   - Sound effects
   - Haptic feedback (mobile)

---

## Dependencies

```json
{
  "@headlessui/react": "^1.7.x",
  "@heroicons/react": "^2.0.x",
  "react-hook-form": "^7.x",
  "@hookform/resolvers": "^3.x",
  "zod": "^3.x"
}
```

---

## File Structure

```
frontend/src/components/bots/
├── ApiKeyDisplay.tsx      # Key display component
├── ApiKeyModal.tsx        # Password + reveal modal
└── CreateBotModal.tsx     # Existing bot creation modal
```

---

## Support

For issues or questions:
- Check component props and types
- Review error handling section
- Test with different scenarios
- Check browser console for errors

---

**Created:** 2024-01-15
**Version:** 1.0.0
**Status:** ✅ Complete
