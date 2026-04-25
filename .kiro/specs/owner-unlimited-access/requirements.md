# Requirements Document: Owner Unlimited Access & User Roles

## Introduction

This document outlines requirements for implementing a role-based system where the platform owner has unlimited access without billing restrictions, while regular users operate under subscription plans with quotas and rate limits.

## Glossary

- **System**: The WhatsApp API Service platform
- **Owner**: The platform administrator with unlimited privileges (you)
- **Regular User**: A paying customer with subscription-based access
- **Admin User**: A user with elevated privileges but still subject to billing
- **Subscription Plan**: A pricing tier that defines usage limits and features
- **Quota**: A limit on resource usage (messages, bots, API calls)
- **Bypass Flag**: A system flag that exempts a user from billing and quota checks

## Requirements

### Requirement 1: User Role System

**User Story:** As a platform owner, I want a role-based access system, so that I can have unlimited access while regular users operate under subscription plans.

#### Acceptance Criteria

1. THE System SHALL support three user roles: Owner, Admin, and User
2. THE System SHALL assign the Owner role to users with a specific email address or user ID configured in environment variables
3. THE System SHALL allow multiple Owner accounts for redundancy
4. THE System SHALL display the user's role in the dashboard header
5. THE System SHALL persist role assignments in the database users table

### Requirement 2: Owner Unlimited Access

**User Story:** As the platform owner, I want unlimited access to all features without billing restrictions, so that I can use the platform for my own business needs without costs.

#### Acceptance Criteria

1. WHEN a user has the Owner role, THE System SHALL bypass all quota checks for message sending
2. WHEN a user has the Owner role, THE System SHALL bypass all rate limiting restrictions
3. WHEN a user has the Owner role, THE System SHALL allow creating unlimited bots
4. WHEN a user has the Owner role, THE System SHALL not display billing information or payment prompts
5. THE System SHALL display "Unlimited" instead of quota numbers for Owner accounts

### Requirement 3: Owner Dashboard Customization

**User Story:** As the platform owner, I want a customized dashboard experience, so that I see relevant information without billing clutter.

#### Acceptance Criteria

1. WHEN an Owner views the dashboard, THE System SHALL hide the billing widget
2. WHEN an Owner views the dashboard, THE System SHALL display "Owner Account - Unlimited Access" badge
3. WHEN an Owner navigates to the billing page, THE System SHALL display a message "Billing not applicable for owner accounts"
4. THE System SHALL show owner-specific metrics (total platform usage, all users' statistics)
5. THE System SHALL provide quick access to admin panel for Owners

### Requirement 4: Regular User Billing Integration

**User Story:** As a regular user, I want clear visibility of my subscription and usage, so that I can manage my account and avoid service interruptions.

#### Acceptance Criteria

1. WHEN a regular user exceeds their quota, THE System SHALL block new message requests with a clear error message
2. WHEN a regular user's subscription expires, THE System SHALL disable message sending but preserve data
3. THE System SHALL display current usage percentage on the dashboard for regular users
4. THE System SHALL send email notifications when usage reaches 80% and 100% of quota
5. THE System SHALL allow regular users to upgrade their plan at any time

### Requirement 5: Quota Enforcement Logic

**User Story:** As a platform administrator, I want automated quota enforcement, so that the system maintains fair usage without manual intervention.

#### Acceptance Criteria

1. THE System SHALL check user role before applying quota limits
2. WHEN a user is not an Owner, THE System SHALL enforce daily and monthly message limits based on their subscription plan
3. THE System SHALL track message count per user per billing period
4. THE System SHALL reset monthly quotas on the subscription renewal date
5. THE System SHALL log all quota check bypasses for Owner accounts for audit purposes

### Requirement 6: Owner Configuration Management

**User Story:** As a platform owner, I want to configure owner accounts via environment variables, so that I can grant unlimited access without database changes.

#### Acceptance Criteria

1. THE System SHALL read owner email addresses from the OWNER_EMAILS environment variable (comma-separated list)
2. THE System SHALL read owner user IDs from the OWNER_USER_IDS environment variable (comma-separated list)
3. WHEN a user registers with an owner email, THE System SHALL automatically assign the Owner role
4. THE System SHALL allow promoting existing users to Owner role via admin panel
5. THE System SHALL require authentication to modify owner assignments

### Requirement 7: Subscription Plan Management

**User Story:** As a platform administrator, I want to define subscription plans with different quotas, so that I can offer tiered pricing to customers.

#### Acceptance Criteria

1. THE System SHALL support defining plans with: name, price, message quota, bot limit, and features
2. THE System SHALL provide a default Free plan with 100 messages per month and 1 bot
3. THE System SHALL allow creating custom plans via admin panel
4. THE System SHALL display available plans on a pricing page for users to compare
5. THE System SHALL track which plan each user is subscribed to

### Requirement 8: Owner Audit Trail

**User Story:** As a platform owner, I want to see audit logs of my unlimited access usage, so that I can monitor my own activity for security and compliance.

#### Acceptance Criteria

1. THE System SHALL log all actions taken by Owner accounts with timestamps
2. THE System SHALL display owner activity in a dedicated audit log page
3. THE System SHALL track message volume sent by Owner accounts separately from regular users
4. THE System SHALL provide export functionality for owner audit logs
5. THE System SHALL retain audit logs for at least 90 days

### Requirement 9: Mixed Account Management

**User Story:** As a platform owner managing multiple businesses, I want to have both owner accounts and regular paid accounts, so that I can separate personal and client usage.

#### Acceptance Criteria

1. THE System SHALL allow the same person to have multiple accounts with different roles
2. THE System SHALL display a role switcher if a user has multiple accounts
3. THE System SHALL maintain separate billing and quotas for non-owner accounts
4. THE System SHALL allow owners to create "test" regular accounts for testing billing flows
5. THE System SHALL clearly indicate which account is currently active in the UI

### Requirement 10: Owner Privilege Restrictions

**User Story:** As a security-conscious platform owner, I want certain sensitive operations to require additional authentication, so that unlimited access doesn't compromise security.

#### Acceptance Criteria

1. WHEN an Owner attempts to delete all data, THE System SHALL require password re-authentication
2. WHEN an Owner attempts to modify other owner accounts, THE System SHALL require two-factor authentication if enabled
3. THE System SHALL log all privileged operations with IP address and user agent
4. THE System SHALL send email notifications for sensitive owner actions
5. THE System SHALL allow configuring which operations require additional authentication
