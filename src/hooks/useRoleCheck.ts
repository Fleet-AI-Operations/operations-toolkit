import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { hasPermission } from '@/lib/permissions';
import type { UserRole } from '@prisma/client';

interface UseRoleCheckOptions {
    allowedRoles?: string[];
    redirectOnUnauthorized?: string;
    redirectOnUnauthenticated?: string;
}

export function useRoleCheck(options: UseRoleCheckOptions = {}) {
    const {
        allowedRoles = [],
        redirectOnUnauthorized = '/',
        redirectOnUnauthenticated = '/login'
    } = options;

    const router = useRouter();
    const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
    const [userRole, setUserRole] = useState<string | null>(null);

    useEffect(() => {
        const checkRole = async () => {
            const supabase = createClient();
            if (!supabase) {
                router.push(redirectOnUnauthorized);
                return;
            }

            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                router.push(redirectOnUnauthenticated);
                return;
            }

            const { data: profile } = await supabase
                .from('profiles')
                .select('role')
                .eq('id', user.id)
                .single();

            const role = profile?.role || 'USER';
            setUserRole(role);

            // If no specific roles required, just check authentication
            if (allowedRoles.length === 0) {
                setIsAuthorized(true);
                return;
            }

            // Check if user has permission for any of the allowed roles using hierarchical check
            const hasRequiredPermission = allowedRoles.some(allowedRole =>
                hasPermission(role as UserRole, allowedRole as UserRole)
            );

            if (hasRequiredPermission) {
                setIsAuthorized(true);
            } else {
                router.push(redirectOnUnauthorized);
            }
        };

        checkRole();
    }, [router, allowedRoles, redirectOnUnauthorized, redirectOnUnauthenticated]);

    return { isAuthorized, userRole };
}
