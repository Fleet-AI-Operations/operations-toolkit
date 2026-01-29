import { Suspense } from 'react';
import TopBottom10Review from '@/components/TopBottom10Review';

export const metadata = {
  title: 'Review Top/Bottom 10 | Task Data',
  description: 'Review and validate top/bottom 10 record classifications.',
};

export default function TopBottom10Page() {
  return (
    <main style={{ padding: '40px 0' }}>
      <Suspense fallback={<div style={{ textAlign: 'center', color: '#60a5fa', padding: '40px 20px' }}>Loading...</div>}>
        <TopBottom10Review />
      </Suspense>
    </main>
  );
}
