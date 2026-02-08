import { Suspense } from 'react';
import TopPromptsReview from '@/components/TopPromptsReview';

export const metadata = {
  title: 'Top Prompts Review',
  description: 'Review top prompts filtered by environment with verification status.',
};

export default function TopPromptsPage() {
  return (
    <main>
      <Suspense fallback={<div style={{ textAlign: 'center', color: '#60a5fa', padding: '40px 20px' }}>Loading...</div>}>
        <TopPromptsReview />
      </Suspense>
    </main>
  );
}
