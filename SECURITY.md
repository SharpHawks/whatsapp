# Security Guidelines

## Overview

This document outlines the security measures implemented in the WhatsApp API Monetization Platform and provides guidelines for maintaining security.

## Implemented Security Measures

### 1. Authentication & Authorization

- **JWT Tokens**: Access tokens (24h) and refresh tokens (7d)
- **API Keys**: SHA-256 hashed, stored securely
- **Password Hashing**: Bcrypt with 10 salt rounds
- **Password Requirements**:
  - Minimum 8 characters
  - At least one uppercase letter
  - At least one lowercase letter
  - At least one number
  - At least one special character

### 2. Rate Limiting

- **Global Rate Limit**: 100 requests per minute per user
- **Login Rate Limit**: 5 attempts per 15 minutes, then 15-minute block
- **Password Verification**: 3 attempts per 5 minutes

### 3. Input Validation & Sanitization

- All string inputs are sanitized to prevent XSS
- UUID format validation for IDs
- Email format validation
- Phone number validation
- Request body size limits (10MB)

### 4. HTTP Security Headers

- **Helmet.js**: Configured with CSP, HSTS, and other security headers
- **CORS**: Configurable origin whitelist for production
- **Content Security Policy**: Strict CSP rules
- **HSTS**: 1 year max-age with includeSubDomains and preload

### 5. Data Protection

- **SQL Injection Prevention**: Parameterized queries only
- **API Key Caching**: Redis cache with TTL
- **Sensitive Data Logging**: Audit logs for critical operations
- **Password Verification**: Rate-limited with audit logging

### 6. Error Handling

- Centralized error handling
- No sensitive information in error messages
- Proper HTTP status codes
- Request ID tracking

## Configuration

### Environment Variables

**CRITICAL**: Never use default values in production!

1. Generate secure secrets:
```bash
node scripts/generate-secrets.js
```

2. Update `.env` file with generated values

3. Configure CORS origins:
```env
CORS_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
```

### Required Changes for Production

1. **JWT Secrets**: Generate 64-byte random hex strings
2. **Database Password**: Use strong password (32+ characters)
3. **Redis Password**: Enable and set strong password
4. **CORS Origins**: Whitelist only your domains
5. **HTTPS**: Enable HTTPS and redirect HTTP to HTTPS
6. **Environment**: Set `NODE_ENV=production`

## Security Checklist

### Before Deployment

- [ ] Generate and set strong JWT secrets
- [ ] Set strong database password
- [ ] Enable and set Redis password
- [ ] Configure CORS whitelist
- [ ] Enable HTTPS
- [ ] Review and update CSP rules
- [ ] Set up SSL/TLS certificates
- [ ] Configure firewall rules
- [ ] Enable database encryption at rest
- [ ] Set up backup encryption
- [ ] Configure log rotation
- [ ] Set up monitoring and alerts
- [ ] Review all environment variables
- [ ] Remove test/debug routes in production
- [ ] Update docker-compose.yml for production

### Regular Maintenance

- [ ] Rotate JWT secrets every 90 days
- [ ] Update dependencies monthly
- [ ] Review security logs weekly
- [ ] Audit user permissions quarterly
- [ ] Test backup restoration quarterly
- [ ] Review and update CSP rules as needed
- [ ] Monitor rate limit effectiveness
- [ ] Check for security vulnerabilities

## Secrets Management

### Development

- Use `.env` file (never commit to git)
- Use `.env.example` as template
- Generate secrets with provided script

### Production

Recommended options:

1. **AWS Secrets Manager** (recommended for AWS)
2. **HashiCorp Vault**
3. **Azure Key Vault** (for Azure)
4. **Google Secret Manager** (for GCP)
5. **Environment variables** (encrypted at rest)

### Docker Secrets

For Docker Swarm:

```bash
echo "your_secret" | docker secret create jwt_secret -
```

Update docker-compose.yml to use secrets:

```yaml
secrets:
  jwt_secret:
    external: true
```

## Incident Response

### If Secrets Are Compromised

1. **Immediately**:
   - Rotate all affected secrets
   - Invalidate all active sessions
   - Review access logs
   - Notify affected users

2. **Investigation**:
   - Identify breach source
   - Assess impact
   - Document timeline

3. **Prevention**:
   - Implement additional controls
   - Update security procedures
   - Train team members

### Reporting Security Issues

If you discover a security vulnerability:

1. **DO NOT** open a public issue
2. Email: security@yourdomain.com
3. Include:
   - Description of vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

## Security Best Practices

### For Developers

1. **Never** commit secrets to version control
2. **Always** use parameterized queries
3. **Always** validate and sanitize user input
4. **Never** log sensitive information
5. **Always** use HTTPS in production
6. **Always** implement proper error handling
7. **Never** expose internal error details to users
8. **Always** use rate limiting on public endpoints
9. **Always** implement proper authentication
10. **Never** trust client-side validation alone

### For Administrators

1. Keep all dependencies up to date
2. Monitor security advisories
3. Regularly review access logs
4. Implement network segmentation
5. Use principle of least privilege
6. Enable database audit logging
7. Set up intrusion detection
8. Implement DDoS protection
9. Regular security audits
10. Maintain incident response plan

## Compliance

### GDPR Considerations

- User data encryption
- Right to deletion
- Data export functionality
- Privacy policy
- Cookie consent
- Data retention policies

### PCI DSS (if handling payments)

- Secure payment processing
- No storage of card data
- Use Stripe for payment handling
- Regular security audits
- Access control

## Additional Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)
- [Express Security Best Practices](https://expressjs.com/en/advanced/best-practice-security.html)
- [Helmet.js Documentation](https://helmetjs.github.io/)

## Updates

This document should be reviewed and updated:
- After any security incident
- When new features are added
- At least quarterly
- When security best practices change

Last Updated: 2024-01-13
