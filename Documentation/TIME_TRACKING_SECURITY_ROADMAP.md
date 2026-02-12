# Time Tracking API - Security Implementation Roadmap

## Current Status: ⚠️ UNAUTHENTICATED (Development Only)

The `/api/time-entries/record` endpoint is currently **intentionally unauthenticated** to facilitate rapid development and testing. This is a **temporary state** and must be addressed before production deployment.

---

## 🚨 Critical Security Issues (Current State)

### High-Risk Vulnerabilities

| Issue | Risk Level | Description |
|-------|-----------|-------------|
| No Authentication | 🔴 CRITICAL | Anyone can submit time entries for any email address |
| No Rate Limiting | 🔴 CRITICAL | Vulnerable to spam/DoS attacks |
| No Request Validation | 🟠 HIGH | Limited abuse detection |
| No Audit Trail | 🟠 HIGH | Cannot track who submitted what |
| No CORS Restrictions | 🟡 MEDIUM | Any website can call the API |
| No Email Verification | 🟡 MEDIUM | Cannot verify email ownership |

### Potential Attack Scenarios

1. **Malicious Time Entry Injection**: Attacker submits false time entries for legitimate users
2. **Spam/DoS**: Flood endpoint with thousands of requests
3. **Data Pollution**: Submit gibberish data to corrupt analytics
4. **Impersonation**: Submit entries claiming to be other users
5. **Resource Exhaustion**: Overwhelm database with millions of entries

---

## 🛡️ Security Implementation Roadmap

### Phase 1: Core Authentication (REQUIRED FOR PRODUCTION)

**Priority**: 🔴 CRITICAL
**Estimated Effort**: 3-5 days
**Blocker for**: Production deployment

#### Tasks:

- [ ] **1.1 Design API Token System**
  - Define token format (e.g., `tk_` prefix + random string)
  - Determine token length and entropy (recommended: 32+ characters)
  - Choose hashing algorithm (bcrypt or argon2)
  - Define token scopes/permissions

- [ ] **1.2 Create Database Schema**
  ```sql
  CREATE TABLE api_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL,
    name TEXT NOT NULL,  -- User-friendly name
    scopes TEXT[] DEFAULT ARRAY['time_entries:write'],
    expires_at TIMESTAMPTZ,
    last_used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    revoked_at TIMESTAMPTZ
  );

  CREATE INDEX idx_api_tokens_user_id ON api_tokens(user_id);
  CREATE INDEX idx_api_tokens_token_hash ON api_tokens(token_hash);
  CREATE INDEX idx_api_tokens_expires_at ON api_tokens(expires_at);
  ```

- [ ] **1.3 Build Token Management API**
  - `POST /api/auth/tokens` - Generate new token (authenticated)
  - `GET /api/auth/tokens` - List user's tokens (authenticated)
  - `DELETE /api/auth/tokens/:id` - Revoke token (authenticated)
  - `PATCH /api/auth/tokens/:id` - Update token name (authenticated)

- [ ] **1.4 Create Token Management UI**
  - Add "API Tokens" section to user settings
  - Show list of active tokens with last used date
  - "Generate New Token" button with name input
  - Copy token to clipboard functionality
  - Revoke token confirmation dialog
  - Show token ONLY once on creation (security best practice)

- [ ] **1.5 Implement Authentication Middleware**
  ```typescript
  // apps/user/src/lib/auth-middleware.ts
  export async function validateApiToken(request: NextRequest) {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return { error: 'Missing or invalid Authorization header' };
    }

    const token = authHeader.substring(7);
    const tokenHash = await hashToken(token);

    const apiToken = await prisma.apiToken.findFirst({
      where: {
        tokenHash: tokenHash,
        revokedAt: null,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } }
        ]
      },
      include: { user: true }
    });

    if (!apiToken) {
      return { error: 'Invalid or expired token' };
    }

    // Update last used timestamp
    await prisma.apiToken.update({
      where: { id: apiToken.id },
      data: { lastUsedAt: new Date() }
    });

    return { userId: apiToken.userId, user: apiToken.user };
  }
  ```

- [ ] **1.6 Update /record Endpoint**
  - Add authentication middleware
  - Derive email from token (remove email from request body)
  - Return 401 for missing/invalid tokens
  - Update tests

- [ ] **1.7 Documentation Updates**
  - Update API docs with authentication examples
  - Create token generation guide
  - Update browser extension example code

**Acceptance Criteria**:
- ✅ All requests to `/record` require valid API token
- ✅ Users can generate/revoke tokens in UI
- ✅ Token validation works correctly
- ✅ All tests passing
- ✅ Documentation complete

---

### Phase 2: Rate Limiting (REQUIRED FOR PRODUCTION)

**Priority**: 🔴 CRITICAL
**Estimated Effort**: 2-3 days
**Blocker for**: Production deployment

#### Tasks:

- [ ] **2.1 Choose Rate Limiting Strategy**
  - Option A: Redis-based (recommended for multi-instance)
  - Option B: In-memory (simple, single-instance only)
  - Decision: _________

- [ ] **2.2 Implement Rate Limiting Middleware**
  ```typescript
  // apps/user/src/lib/rate-limiter.ts
  export async function checkRateLimit(
    userId: string,
    action: string,
    limit: number = 100,
    windowMs: number = 60 * 60 * 1000 // 1 hour
  ) {
    const key = `ratelimit:${userId}:${action}`;
    const count = await incrementCounter(key, windowMs);

    if (count > limit) {
      return {
        allowed: false,
        retryAfter: getRetryAfter(key)
      };
    }

    return { allowed: true, remaining: limit - count };
  }
  ```

- [ ] **2.3 Apply to /record Endpoint**
  - Limit: 100 requests per hour per user
  - Return 429 with Retry-After header
  - Include rate limit info in response headers

- [ ] **2.4 Admin Monitoring Dashboard**
  - Show current rate limit usage per user
  - Alert on suspicious activity (hitting limits)

**Acceptance Criteria**:
- ✅ Rate limiting enforces 100 req/hour per user
- ✅ 429 responses include Retry-After header
- ✅ Admin can view rate limit metrics
- ✅ Tests verify rate limiting works

---

### Phase 3: Enhanced Security (Recommended)

**Priority**: 🟠 HIGH
**Estimated Effort**: 2-3 days
**Blocker for**: Public production use

#### Tasks:

- [ ] **3.1 CORS Configuration**
  - Restrict to authorized domains only
  - Implement CORS middleware
  - Add domain whitelist to environment config

- [ ] **3.2 Enhanced Audit Logging**
  ```sql
  CREATE TABLE api_request_logs (
    id UUID PRIMARY KEY,
    user_id UUID,
    api_token_id UUID,
    endpoint TEXT,
    method TEXT,
    ip_address INET,
    user_agent TEXT,
    status_code INT,
    response_time_ms INT,
    created_at TIMESTAMPTZ DEFAULT NOW()
  );
  ```

- [ ] **3.3 Abuse Detection**
  - Flag suspicious patterns (too many failed requests)
  - Auto-revoke tokens with suspicious activity
  - Email alerts to users when token is revoked

- [ ] **3.4 Token Rotation**
  - Implement automatic token expiration (e.g., 90 days)
  - Email reminders before expiration
  - Easy token renewal process

- [ ] **3.5 IP Allowlisting (Optional)**
  - Allow users to restrict tokens to specific IPs
  - Useful for browser extensions on known machines

**Acceptance Criteria**:
- ✅ CORS properly configured
- ✅ All API requests logged
- ✅ Abuse detection catches obvious attacks
- ✅ Token expiration works correctly

---

### Phase 4: Advanced Features (Nice-to-Have)

**Priority**: 🟡 MEDIUM
**Estimated Effort**: 3-5 days
**Blocker for**: None

#### Tasks:

- [ ] **4.1 Email Verification**
  - Require email verification before accepting time entries
  - Send verification code to email
  - User enters code in browser extension

- [ ] **4.2 Webhook Support**
  - Allow users to register webhooks for time entry events
  - Send POST to webhook URL when entry created
  - Include signature for verification

- [ ] **4.3 Batch API**
  - Accept multiple time entries in single request
  - Reduce API calls from browser extension
  - All-or-nothing transaction

- [ ] **4.4 GraphQL API**
  - Alternative to REST API
  - Better for complex queries
  - Single endpoint

---

## 📋 Migration Plan (Unauthenticated → Authenticated)

### Timeline

| Phase | Duration | Status |
|-------|----------|--------|
| Development | 1-2 weeks | 🔴 Not Started |
| Internal Testing | 3-5 days | 🔴 Not Started |
| Beta Testing | 1-2 weeks | 🔴 Not Started |
| Production Rollout | 1 week | 🔴 Not Started |

### Rollout Strategy

#### Week 1-2: Development
1. Implement authentication system (Phase 1)
2. Implement rate limiting (Phase 2)
3. Update documentation
4. Write comprehensive tests

#### Week 3: Internal Testing
1. Deploy to staging environment
2. Test token generation/revocation
3. Test rate limiting
4. Test browser extension with new auth

#### Week 4-5: Beta Testing
1. Select 5-10 beta users
2. Have them generate tokens
3. Update their browser extensions
4. Gather feedback
5. Fix bugs

#### Week 6: Production Rollout

**Deprecation Schedule**:

| Date | Action |
|------|--------|
| Day 1 | Launch authenticated endpoint `/api/time-entries/record` |
| Day 1 | Send email to all users: "Generate API tokens by [Date]" |
| Day 14 | Warning in unauthenticated responses: "This endpoint will be deprecated" |
| Day 21 | Final reminder email |
| Day 28 | Disable unauthenticated endpoint |
| Day 30 | Remove unauthenticated endpoint code |

**Communication Plan**:
- Email notifications at Day 1, 21, and 28
- In-app banners for users without tokens
- Documentation updates
- Browser extension update with instructions

---

## 🧪 Testing Strategy

### Unit Tests
- [ ] Token generation
- [ ] Token validation
- [ ] Token hashing/comparison
- [ ] Rate limiting logic
- [ ] Middleware functions

### Integration Tests
- [ ] End-to-end token flow
- [ ] Authenticated API requests
- [ ] Rate limiting enforcement
- [ ] Token revocation

### Security Tests
- [ ] Token brute force prevention
- [ ] SQL injection attempts
- [ ] Rate limit bypass attempts
- [ ] Invalid token handling

### Load Tests
- [ ] 1000 requests/minute sustained
- [ ] Token validation performance
- [ ] Rate limit counter performance

---

## 📊 Success Metrics

- [ ] 100% of API requests authenticated
- [ ] Zero security incidents
- [ ] Token validation < 50ms P95
- [ ] Rate limiting accurate within 5%
- [ ] < 5% support tickets related to authentication

---

## 🔧 Technical Decisions to Make

| Decision | Options | Recommendation | Status |
|----------|---------|----------------|--------|
| Token Format | JWT vs Random String | Random String (simpler, revocable) | ⏳ Pending |
| Token Storage | Redis vs PostgreSQL | PostgreSQL (already in use) | ⏳ Pending |
| Token Expiration | 30/60/90/365 days | 90 days (balance security/UX) | ⏳ Pending |
| Rate Limit Backend | Redis vs In-Memory | Redis (if multi-instance) | ⏳ Pending |
| Rate Limit Window | 1h/24h/7d | 1 hour (100 req/hour) | ⏳ Pending |

---

## 📚 References

- [OWASP API Security Top 10](https://owasp.org/www-project-api-security/)
- [RFC 6750 - Bearer Token Usage](https://tools.ietf.org/html/rfc6750)
- [Rate Limiting Strategies](https://cloud.google.com/architecture/rate-limiting-strategies-techniques)
- [GitHub API Token Best Practices](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/about-authentication-to-github)

---

## 👥 Stakeholders

| Role | Name | Responsibility |
|------|------|---------------|
| Project Lead | TBD | Overall timeline and priorities |
| Backend Developer | TBD | API implementation |
| Frontend Developer | TBD | UI for token management |
| DevOps | TBD | Deployment and monitoring |
| Security Review | TBD | Security audit before production |

---

**Last Updated**: 2026-02-12
**Next Review**: Before production deployment
**Status**: 🔴 Authentication Required - Do Not Deploy to Production
