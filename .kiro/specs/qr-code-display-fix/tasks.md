# Implementation Plan

- [x] 1. Enhance Backend QR Code Storage and Emission





  - Update `updateBotQRCode` method to store QR code with timestamp in database
  - Add error handling for WebSocket emission failures with fallback logging
  - Ensure QR code is cleared from database when bot successfully connects
  - Add detailed logging for QR generation, storage, and emission events
  - _Requirements: 2.1, 2.4, 2.5, 3.1, 3.5_

- [x] 2. Implement Frontend QR Code Polling with Timeout



  - Modify `useBotQR` hook to enable polling every 2 seconds using `refetchInterval`
  - Add timeout logic that stops polling after 30 seconds
  - Implement automatic polling stop when QR code is received
  - Add state management for loading, timeout, and error states
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_




- [ ] 3. Integrate WebSocket QR Code Updates with Polling
  - Update `useBotQR` hook to listen for WebSocket `bot:qr` events
  - Implement logic to stop polling immediately when QR received via WebSocket
  - Update query cache when WebSocket delivers QR code
  - Add console logging for debugging WebSocket QR reception
  - _Requirements: 2.2, 2.3, 2.5_

- [x] 4. Enhance Reconnect Modal UI with Error States



  - Add timeout state display with "QR code generation timed out" message
  - Implement retry button that restarts the connection process
  - Add cancel button to close modal and stop polling
  - Display appropriate loading states during QR generation
  - Show success message when bot connects (auto-close after 2 seconds)
  - _Requirements: 4.2, 4.3, 4.4, 5.3_


- [x] 5. Improve Connection Status Synchronization


  - Ensure WebSocket `bot:status` events update bot list in real-time
  - Implement automatic modal close when bot status changes to 'connected'
  - Update bot badges to reflect current connection status accurately
  - Add visual feedback for connection state transitions
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [x] 6. Add Comprehensive Error Handling and Logging



  - Implement user-friendly error messages for different failure scenarios
  - Add backend error logging with appropriate log levels (info, warn, error, debug)
  - Handle edge cases (bot already connected, bot not found, network errors)
  - Add error recovery options (retry button, close and try again)
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

- [ ] 7. Write integration tests for QR code flow
  - Test complete flow: connect → QR generation → storage → emission → display
  - Test timeout scenario: verify error appears after 30 seconds
  - Test WebSocket fallback: disconnect WebSocket, verify HTTP polling works
  - Test retry functionality: timeout → click retry → new QR appears
  - Test modal close: verify polling stops when modal is closed
  - _Requirements: All requirements_
