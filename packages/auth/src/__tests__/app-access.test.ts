import { describe, it, expect } from 'vitest';
import { hasMinRole, hasAppAccess } from '../app-access';

describe('hasMinRole', () => {
    describe('returns true when role meets or exceeds minimum', () => {
        it('CORE meets CORE', () => expect(hasMinRole('CORE', 'CORE')).toBe(true));
        it('FLEET meets CORE', () => expect(hasMinRole('FLEET', 'CORE')).toBe(true));
        it('MANAGER meets CORE', () => expect(hasMinRole('MANAGER', 'CORE')).toBe(true));
        it('ADMIN meets CORE', () => expect(hasMinRole('ADMIN', 'CORE')).toBe(true));
        it('FLEET meets FLEET', () => expect(hasMinRole('FLEET', 'FLEET')).toBe(true));
        it('ADMIN meets FLEET', () => expect(hasMinRole('ADMIN', 'FLEET')).toBe(true));
        it('QA meets QA', () => expect(hasMinRole('QA', 'QA')).toBe(true));
        it('CORE meets QA', () => expect(hasMinRole('CORE', 'QA')).toBe(true));
        it('ADMIN meets USER', () => expect(hasMinRole('ADMIN', 'USER')).toBe(true));
    });

    describe('returns false when role is below minimum', () => {
        it('QA does not meet CORE', () => expect(hasMinRole('QA', 'CORE')).toBe(false));
        it('USER does not meet QA', () => expect(hasMinRole('USER', 'QA')).toBe(false));
        it('USER does not meet CORE', () => expect(hasMinRole('USER', 'CORE')).toBe(false));
        it('USER does not meet FLEET', () => expect(hasMinRole('USER', 'FLEET')).toBe(false));
        it('CORE does not meet FLEET', () => expect(hasMinRole('CORE', 'FLEET')).toBe(false));
        it('PENDING does not meet USER', () => expect(hasMinRole('PENDING', 'USER')).toBe(false));
    });

    describe('handles unknown roles safely', () => {
        it('unknown role does not meet USER', () => expect(hasMinRole('UNKNOWN', 'USER')).toBe(false));
        it('empty string does not meet USER', () => expect(hasMinRole('', 'USER')).toBe(false));
    });

    describe('MANAGER is treated as equivalent to ADMIN (legacy role)', () => {
        it('MANAGER meets FLEET', () => expect(hasMinRole('MANAGER', 'FLEET')).toBe(true));
        it('MANAGER meets CORE', () => expect(hasMinRole('MANAGER', 'CORE')).toBe(true));
    });
});

describe('hasAppAccess', () => {
    it('CORE can access core app', () => expect(hasAppAccess('CORE', 'core')).toBe(true));
    it('QA cannot access core app', () => expect(hasAppAccess('QA', 'core')).toBe(false));
    it('FLEET can access fleet app', () => expect(hasAppAccess('FLEET', 'fleet')).toBe(true));
    it('CORE cannot access fleet app', () => expect(hasAppAccess('CORE', 'fleet')).toBe(false));
    it('ADMIN can access all apps', () => {
        expect(hasAppAccess('ADMIN', 'user')).toBe(true);
        expect(hasAppAccess('ADMIN', 'qa')).toBe(true);
        expect(hasAppAccess('ADMIN', 'core')).toBe(true);
        expect(hasAppAccess('ADMIN', 'fleet')).toBe(true);
        expect(hasAppAccess('ADMIN', 'admin')).toBe(true);
    });
    it('USER can only access user app', () => {
        expect(hasAppAccess('USER', 'user')).toBe(true);
        expect(hasAppAccess('USER', 'qa')).toBe(false);
        expect(hasAppAccess('USER', 'core')).toBe(false);
    });
});
