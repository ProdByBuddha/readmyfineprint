# Organization Invitations System

## Overview

The invitation system allows organization admins to invite new members to their organization via email. Invitations are secure, time-limited, and enforce seat limits.

## Features

- **Secure token generation**: Uses HMAC-SHA256 with server secret
- **Token hashing**: Full tokens are never stored in the database
- **Email verification**: Invitees must accept with matching email address
- **Seat limit enforcement**: Checks limits at invitation creation and acceptance
- **Expiration**: Invitations expire after 7 days
- **Rate limiting**: Prevents invitation spam (10 per hour per org)
- **Duplicate prevention**: Only one active invitation per email per org

## API Endpoints

### Create Invitation

```http
POST /api/orgs/:orgId/invitations
Authorization: Bearer <token>
X-Org-Id: <orgId>
Content-Type: application/json

{
  "email": "user@example.com",
  "role": "member"
}
```

**Requirements:**
- User must be org admin
- Organization must have Business+ tier
- Seat limit not reached

**Response:**
```json
{
  "id": "inv_xxx",
  "email": "user@example.com",
  "role": "member",
  "expires_at": "2025-10-08T06:39:21Z",
  "message": "Invitation sent successfully"
}
```

### List Invitations

```http
GET /api/orgs/:orgId/invitations
Authorization: Bearer <token>
X-Org-Id: <orgId>
```

**Requirements:**
- User must be org admin

**Response:**
```json
{
  "invitations": [
    {
      "id": "inv_xxx",
      "email": "user@example.com",
      "role": "member",
      "inviter_user_id": "user_yyy",
      "created_at": "2025-10-01T06:39:21Z",
      "expires_at": "2025-10-08T06:39:21Z",
      "token_prefix": "AbCdEfGh"
    }
  ]
}
```

### Revoke Invitation

```http
DELETE /api/orgs/:orgId/invitations/:invitationId
Authorization: Bearer <token>
X-Org-Id: <orgId>
```

**Requirements:**
- User must be org admin

**Response:**
```json
{
  "message": "Invitation revoked successfully"
}
```

### Get Invitation Details (Public)

```http
GET /api/invitations/:token
```

**No auth required** - used for preview before accepting.

**Response:**
```json
{
  "email": "user@example.com",
  "role": "member",
  "org_name": "Acme Inc",
  "expires_at": "2025-10-08T06:39:21Z"
}
```

### Accept Invitation

```http
POST /api/invitations/:token/accept
Authorization: Bearer <token>
```

**Requirements:**
- User must be authenticated
- User's email must match invitation email
- Invitation must not be expired or revoked
- Seat limit not exceeded

**Response:**
```json
{
  "message": "Invitation accepted successfully",
  "org_id": "org_xxx",
  "role": "member"
}
```

## Email Configuration

The system uses SMTP (via nodemailer) to send invitation emails. Configure with environment variables:

```bash
SMTP_HOST=smtp.mail.me.com
SMTP_PORT=587
SMTP_USER=your-apple-id@icloud.com
SMTP_PASS=your-app-specific-password
SMTP_FROM=your-apple-id@icloud.com
```

### iCloud SMTP Setup

1. Go to https://appleid.apple.com
2. Sign in with your Apple ID
3. Generate an app-specific password
4. Use this password (not your regular password) in `SMTP_PASS`

## Security Features

### Token Generation

- Tokens are 32 bytes of cryptographically secure random data
- Encoded as base64url for URL safety
- Full token only shown once at creation
- Token prefix (8 chars) stored for admin reference

### Token Storage

- Only HMAC-SHA256 hash stored in database
- Hash uses server secret from environment (`INVITATION_SECRET` or `SESSION_SECRET`)
- Tokens cannot be reverse-engineered from database

### Email Privacy

- Email addresses are normalized to lowercase
- Emails are never logged in full (only first 3 chars + `***@***`)
- No email content logged to prevent PII exposure

### Rate Limiting

- Simple throttle: max 10 invitations per org per hour
- TODO: Implement Redis-based distributed rate limiting

## Error Codes

| Code | Status | Description |
|------|--------|-------------|
| `FEATURE_DISABLED` | 403 | Organizations feature not enabled |
| `UNAUTHORIZED` | 401 | Authentication required |
| `FORBIDDEN` | 403 | Access denied to organization |
| `INSUFFICIENT_PERMISSIONS` | 403 | User role insufficient |
| `UPGRADE_REQUIRED` | 402 | Requires Business+ tier |
| `VALIDATION_ERROR` | 400 | Invalid request body |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many invitations |
| `SEAT_LIMIT_REACHED` | 402 | Organization at capacity |
| `DUPLICATE_INVITATION` | 409 | Active invitation exists |
| `INVALID_TOKEN` | 404 | Token not found or expired |
| `EMAIL_MISMATCH` | 403 | Wrong email address |
| `ALREADY_MEMBER` | 409 | User already in org |
| `NOT_FOUND` | 404 | Invitation not found |

## Invitation Flow

```
1. Admin creates invitation
   ├─ Validate permissions (admin role)
   ├─ Check subscription tier (Business+)
   ├─ Enforce seat limit
   ├─ Check for duplicate invitation
   ├─ Generate secure token
   ├─ Store invitation with hashed token
   └─ Send email with accept URL

2. Invitee receives email
   └─ Clicks accept URL

3. Invitee previews invitation (optional)
   └─ GET /api/invitations/:token

4. Invitee accepts invitation
   ├─ Must be authenticated
   ├─ Verify email match
   ├─ Check expiration
   ├─ Check seat limit again
   ├─ Create organization_users row
   ├─ Mark invitation accepted
   └─ Return success

5. Invitee joins organization
   └─ Can now access org resources
```

## Database Schema

```sql
-- organization_invitations table
CREATE TABLE organization_invitations (
  id UUID PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES organizations(id),
  email VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL,
  inviter_user_id UUID NOT NULL REFERENCES users(id),
  token_hash VARCHAR(255) NOT NULL,
  token_prefix VARCHAR(50) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_org_invitations_org_id ON organization_invitations(org_id);
CREATE INDEX idx_org_invitations_email ON organization_invitations(email);
CREATE INDEX idx_org_invitations_token_hash ON organization_invitations(token_hash);
CREATE INDEX idx_org_invitations_expires_at ON organization_invitations(expires_at);
```

## Testing

### Manual Testing

1. **Create invitation:**
   ```bash
   curl -X POST http://localhost:3000/api/orgs/org_123/invitations \
     -H "Authorization: Bearer $TOKEN" \
     -H "X-Org-Id: org_123" \
     -H "Content-Type: application/json" \
     -d '{"email": "test@example.com", "role": "member"}'
   ```

2. **Check email** for invitation link

3. **Preview invitation:**
   ```bash
   curl http://localhost:3000/api/invitations/$TOKEN
   ```

4. **Accept invitation:**
   ```bash
   curl -X POST http://localhost:3000/api/invitations/$TOKEN/accept \
     -H "Authorization: Bearer $USER_TOKEN"
   ```

### Unit Tests

See `server/__tests__/invitation-service.test.ts` for comprehensive tests.

## Troubleshooting

### Email Not Sending

1. Verify SMTP credentials in `.env`
2. Check SMTP logs: `tail -f logs/email.log`
3. Test SMTP connection manually with telnet
4. Ensure firewall allows outbound port 587

### Invalid Token Error

- Tokens expire after 7 days
- Check `expires_at` in database
- Ensure `INVITATION_SECRET` hasn't changed

### Seat Limit Issues

- Check `organizations.seat_limit`
- Count active members: `SELECT COUNT(*) FROM organization_users WHERE org_id = 'xxx' AND status = 'active'`
- Count pending invitations
- Admin can upgrade plan or remove members

## Future Enhancements

- [ ] Domain-based auto-join (allow @company.com users to join without invitation)
- [ ] Bulk invitations via CSV upload
- [ ] Customizable invitation email templates
- [ ] Invitation link preview with org branding
- [ ] Resend invitation email
- [ ] Invitation analytics dashboard
- [ ] SSO integration (SAML, OAuth)
