import AlignmentScoring from '@/components/AlignmentScoring';

export const metadata = {
    title: 'Alignment Scoring | Operations',
    description: 'Generate and view alignment scores for records.',
};

export default function AlignmentScoringPage() {
    return (
        <main>
            <AlignmentScoring />
        </main>
    );
}
