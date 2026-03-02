'use client';

import { UnifiedSidebar } from '@repo/ui/components';

export default function Sidebar({ userRole }: { userRole?: string }) {
    return <UnifiedSidebar currentApp="fleet" userRole={userRole} />;
}
