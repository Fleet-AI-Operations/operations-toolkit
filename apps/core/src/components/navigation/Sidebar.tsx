'use client';

import { UnifiedSidebar } from '@repo/ui/components';

export default function Sidebar({ userRole }: { userRole?: string }) {
    return <UnifiedSidebar currentApp="core" userRole={userRole} />;
}
