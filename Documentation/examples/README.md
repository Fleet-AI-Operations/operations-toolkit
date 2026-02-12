# Browser Extension Examples

## ⚠️ CRITICAL: These Examples Are For Development Only ⚠️

The code examples in this directory demonstrate integration with an **UNAUTHENTICATED** API endpoint that is:

- ✅ Suitable for local development and testing
- ✅ Suitable for MVP/proof-of-concept with trusted users
- ❌ **NOT suitable for production deployment**
- ❌ **NOT suitable for public-facing applications**

## Security Concerns

The current API endpoint has no authentication, which means:

1. **Anyone can submit time entries** for any email address
2. **No rate limiting** - vulnerable to spam/abuse
3. **No audit trail** - cannot track who submitted what
4. **No verification** - cannot confirm user identity

## Before Production Use

**YOU MUST implement authentication** before deploying to production. See:

- **[TIME_TRACKING_SECURITY_ROADMAP.md](../TIME_TRACKING_SECURITY_ROADMAP.md)** - Complete security implementation plan
- **[API_TIME_TRACKING.md](../API_TIME_TRACKING.md#critical-security-warning)** - Security warnings and authentication design

Required before production:
1. ✅ API Token authentication
2. ✅ Rate limiting (100 req/hour recommended)
3. ✅ Request validation and abuse detection
4. ✅ Audit logging
5. ✅ CORS restrictions

## Example Files

- **`browser-extension-example.js`** - Full featured example with timer
- **`BROWSER_EXTENSION_QUICKSTART.md`** - Quick start guide

## Questions?

If you have questions about:
- **Security implementation**: See TIME_TRACKING_SECURITY_ROADMAP.md
- **API usage**: See API_TIME_TRACKING.md
- **Browser extension development**: See BROWSER_EXTENSION_QUICKSTART.md

---

**Status**: 🔴 Development Only - Authentication Required for Production
