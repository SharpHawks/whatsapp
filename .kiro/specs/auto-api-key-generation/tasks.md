# Implementation Plan - Auto API Key Generation

## Task List

- [x] 1. Backend: Add password verification endpoint






  - Add POST `/api/v1/auth/verify-password` endpoint
  - Implement rate limiting (3 attempts per 5 minutes)
  - Add audit logging for password attempts
  - _Requirements: 3.4, 5.1, 6.3, 6.4_

- [x] 2. Backend: Add API key management endpoints





- [x] 2.1 Add API key reveal endpoint
  - Add POST `/api/v1/bots/:botId/api-key/reveal` endpoint
  - Integrate password verification
  - Implement Redis cache lookup for recent keys
  - Handle key expiration gracefully
  - _Requirements: 3.5, 3.6, 5.3, 5.6_

- [x] 2.2 Add API key info endpoint
  - Add GET `/api/v1/bots/:botId/api-key` endpoint
  - Return masked key and metadata
  - Verify bot ownership
  - _Requirements: 4.2, 4.3, 4.4, 5.2, 5.6_

- [x] 2.3 Update regenerate endpoint
  - Modify existing `/api/v1/auth/api-keys/regenerate` to work with botId
  - Store new key in Redis with 5-minute TTL
  - Return key with expiration time
  - _Requirements: 4.6, 4.7, 4.8, 5.4_

- [x] 3. Backend: Implement automatic API key generation on bot connection



- [x] 3.1 Add API key generation to connection handler



  - Modify `worker-baileys.manager.ts` connection handler
  - Check for existing API key before generating
  - Generate new key if none exists
  - Store plain text key in Redis (5-minute TTL)
  - _Requirements: 1.1, 1.2, 1.3, 1.4_



- [ ] 3.2 Add WebSocket event for API key generation
  - Emit `bot:apikey:generated` event with botId and key
  - Ensure event reaches correct user


  - Add event to socket service types
  - _Requirements: 1.5, 2.5_






- [ ] 3.3 Add audit logging
  - Log API key generation events
  - Log API key viewing attempts
  - Log password verification attempts
  - Include user ID, bot ID, and timestamp


  - _Requirements: 6.1, 6.2, 6.3, 6.6_

- [ ] 4. Frontend: Create API key display components
- [x] 4.1 Create ApiKeyDisplay component




  - Display API key with copy button
  - Show warning message for one-time display
  - Handle close action
  - Clear key from memory on unmount
  - _Requirements: 2.2, 2.3, 2.5_


- [ ] 4.2 Create ApiKeyModal component
  - Create modal with password input
  - Add "Show API Key" and "Cancel" buttons
  - Handle password submission
  - Display error messages

  - Show API key on successful verification
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.8, 3.9_

- [ ] 5. Frontend: Update BotDetailsPage for API key management
- [x] 5.1 Add API key info display





  - Show masked API key in API Keys tab
  - Display creation date and last used date
  - Add "View Full Key" button
  - Add "Regenerate Key" button with confirmation

  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_

- [ ] 5.2 Integrate ApiKeyModal
  - Open modal on "View Full Key" click
  - Handle successful password verification
  - Display revealed key
  - Handle errors appropriately
  - _Requirements: 3.1, 3.5, 3.6, 3.7_

- [ ] 5.3 Add API key regeneration flow
  - Show confirmation dialog before regeneration
  - Call regenerate endpoint
  - Display new key once
  - Update UI with new key info
  - _Requirements: 4.7, 4.8_

- [ ] 6. Frontend: Update bot connection flow to show API key
- [ ] 6.1 Listen for API key generation event
  - Add event listener for `bot:apikey:generated`
  - Store generated key in component state
  - Clear key when navigating away
  - _Requirements: 2.1, 2.5_

- [ ] 6.2 Replace QR code with API key display
  - Show ApiKeyDisplay instead of QR when bot connects
  - Include warning about one-time display
  - Provide link to bot details for later access
  - _Requirements: 2.1, 2.2, 2.3, 2.4_

- [ ] 7. Backend: Add rate limiting and security
- [ ] 7.1 Implement Redis-based rate limiting
  - Create rate limiter utility
  - Apply to password verification endpoint
  - Apply to API key reveal endpoint
  - Return appropriate error messages
  - _Requirements: 3.7, 5.7, 6.4_

- [ ] 7.2 Add security headers and validation
  - Validate all input parameters
  - Add CSRF protection if needed
  - Ensure HTTPS in production
  - _Requirements: 6.3, 6.5_

- [ ] 8. Testing
- [ ] 8.1 Write backend unit tests
  - Test password verification logic
  - Test API key generation
  - Test rate limiting
  - Test Redis caching

- [ ] 8.2 Write frontend component tests
  - Test ApiKeyDisplay component
  - Test ApiKeyModal component
  - Test event listeners

- [ ] 8.3 Write integration tests
  - Test complete bot connection flow
  - Test API key reveal flow
  - Test API key regeneration flow

- [ ] 9. Documentation and cleanup
- [ ] 9.1 Update API documentation
  - Document new endpoints
  - Add examples for API key operations
  - Update Postman collection
  - _Requirements: All_

- [ ] 9.2 Add user-facing documentation
  - Update user guide with API key instructions
  - Add security best practices
  - Include troubleshooting section
  - _Requirements: All_

## Implementation Notes

### Order of Implementation

1. Start with backend endpoints (tasks 1-3) to establish the API
2. Then implement frontend components (tasks 4-6) to consume the API
3. Add security and rate limiting (task 7)
4. Finally, add tests and documentation (tasks 8-9)

### Dependencies

- Task 2 depends on Task 1 (password verification needed for reveal)
- Task 4 can be done in parallel with Tasks 1-3
- Task 5 depends on Tasks 2 and 4
- Task 6 depends on Task 3
- Task 7 should be done before production deployment
- Tasks 8-9 can be done incrementally

### Testing Strategy

- Test each endpoint individually before integration
- Use Postman to verify API behavior
- Test rate limiting with multiple rapid requests
- Verify WebSocket events are emitted correctly
- Test password verification with correct and incorrect passwords

### Security Checklist

- [ ] All API keys stored as hashes in database
- [ ] Plain text keys only in Redis with TTL
- [ ] Rate limiting on password verification
- [ ] Rate limiting on API key reveal
- [ ] Audit logging for all operations
- [ ] HTTPS enforced in production
- [ ] Input validation on all endpoints
- [ ] Bot ownership verification on all bot endpoints

### Performance Considerations

- Redis caching reduces database load
- WebSocket events provide real-time updates
- Rate limiting prevents abuse
- Indexed database queries for fast lookups

### Rollback Plan

If issues arise:
1. Disable automatic API key generation (feature flag)
2. Fall back to manual key generation
3. Keep existing API key functionality working
4. Fix issues and re-enable feature

## Success Criteria

- [ ] API keys automatically generated when bot connects
- [ ] Users can view API key immediately after connection
- [ ] Users can securely view API key later with password
- [ ] Rate limiting prevents brute force attacks
- [ ] All operations are logged for audit
- [ ] No plain text keys stored in database
- [ ] Frontend provides clear user experience
- [ ] Documentation is complete and accurate
