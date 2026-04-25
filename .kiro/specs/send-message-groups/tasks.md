# Implementation Plan: Send Message to Groups

## Task List

- [x] 1. Backend: Add endpoint to get bot groups





- [x] 1.1 Create GET /api/v1/bots/:botId/groups endpoint in bot.routes.ts


  - Add route handler with JWT authentication
  - Verify bot ownership
  - Call worker manager to get groups
  - Return formatted group list
  - _Requirements: 6.1, 6.2, 6.3, 6.4_

- [x] 1.2 Add getGroups() method to Worker Baileys Manager


  - Get socket connection for bot
  - Call socket.groupFetchAllParticipating()
  - Format group data (id, name, participantCount, isAdmin)
  - Handle errors when bot not connected
  - _Requirements: 7.1, 7.2, 7.4_

- [x] 1.3 Add caching for group lists
  - Cache groups in Redis with 5-minute TTL
  - Invalidate cache on bot reconnect
  - _Requirements: 7.2, 7.3_

- [x] 2. Backend: Enhance message sending for groups



- [x] 2.1 Update message service to support group IDs


  - Detect recipient type (contact vs group) based on format
  - Validate group ID format (@g.us suffix)
  - Support sending to groups via Baileys
  - _Requirements: 4.2, 6.5_

- [x] 2.2 Add recipient_type field to messages table


  - Create migration to add recipient_type column
  - Set default value to 'contact' for existing records
  - Update Message model/interface
  - _Requirements: 4.2_


- [x] 2.3 Add validation for group membership

  - Check if bot is member of group before sending
  - Return appropriate error if not a member
  - _Requirements: 4.4_

- [x] 3. Frontend: Add tabs to SendMessagePage


- [x] 3.1 Update SendMessagePage component structure


  - Add state for activeTab ('contact' | 'group')
  - Create tab navigation UI
  - Implement tab switching logic
  - Style active/inactive tabs
  - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [x] 3.2 Implement conditional rendering based on active tab

  - Show phone number input for 'contact' tab
  - Show group selector for 'group' tab
  - Maintain message input for both tabs
  - _Requirements: 1.2, 2.1, 4.1_

- [x] 4. Frontend: Create GroupSelector component


- [x] 4.1 Create GroupSelector component


  - Create component file and interface
  - Add dropdown/select for groups
  - Display group name and ID
  - Handle loading and empty states
  - _Requirements: 3.1, 3.2, 3.3_

- [x] 4.2 Add API hook for fetching groups


  - Create useGroups hook with React Query
  - Call GET /api/v1/bots/:botId/groups
  - Handle loading, error, and success states
  - _Requirements: 3.1, 3.4_


- [ ] 4.3 Implement group search functionality
  - Add search input field
  - Filter groups by name




  - Debounce search input
  - _Requirements: 3.2_

- [x] 5. Frontend: Create ApiDocumentation component

- [ ] 5.1 Create ApiDocumentation component
  - Create component file
  - Design documentation layout
  - Add collapsible sections
  - _Requirements: 5.1_


- [ ] 5.2 Add curl examples for sending to contacts
  - Show POST /messages/send example
  - Include phone number format
  - Show request/response examples

  - _Requirements: 5.2, 5.4, 5.5_

- [ ] 5.3 Add curl examples for sending to groups
  - Show POST /messages/send example with group ID


  - Include group ID format
  - Show request/response examples
  - _Requirements: 5.3, 5.4, 5.5_

- [ ] 5.4 Add parameter descriptions
  - Document all request parameters
  - Show required vs optional fields





  - Include format examples
  - _Requirements: 5.4_

- [ ] 6. Frontend: Integrate components into SendMessagePage
- [ ] 6.1 Add GroupSelector to group tab
  - Import and render GroupSelector
  - Pass botId and selection handler
  - Update recipient state on group selection
  - _Requirements: 4.1, 4.2_


- [ ] 6.2 Add ApiDocumentation to page bottom
  - Import and render ApiDocumentation
  - Position below send form
  - Pass selected bot for dynamic examples
  - _Requirements: 5.1_


- [ ] 6.3 Update send message logic
  - Determine recipient based on active tab
  - Validate recipient before sending
  - Show appropriate success/error messages
  - _Requirements: 2.3, 4.2, 4.3_

- [ ] 6.4 Add loading states and error handling
  - Show loading spinner when fetching groups
  - Display error messages for failed requests
  - Add retry functionality
  - _Requirements: 3.3_

- [ ] 7. Testing and polish
- [ ] 7.1 Test tab switching functionality
  - Verify tabs switch correctly
  - Check state persistence
  - Test visual indicators
  - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [ ] 7.2 Test sending messages to contacts
  - Send text message to phone number
  - Verify message delivery
  - Check error handling
  - _Requirements: 2.1, 2.2, 2.3, 2.4_

- [ ] 7.3 Test sending messages to groups
  - Send text message to group
  - Verify message appears in group
  - Check error handling
  - _Requirements: 4.1, 4.2, 4.3, 4.4_

- [ ] 7.4 Test group loading and selection
  - Load groups for different bots
  - Test empty state
  - Test error state
  - Verify search functionality
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [ ] 7.5 Add responsive design improvements
  - Test on mobile devices
  - Adjust layout for small screens
  - Ensure tabs work on touch devices

- [ ] 7.6 Add accessibility improvements
  - Add ARIA labels
  - Ensure keyboard navigation
  - Test with screen readers
