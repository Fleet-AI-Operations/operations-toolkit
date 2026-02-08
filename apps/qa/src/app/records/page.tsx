import ListView from '@/components/ListView';

export const metadata = {
    title: 'Explore Records | Task Data',
    description: 'View all records for a specific section.',
};

export default function RecordsPage() {
    return (
        <main>
            <ListView />
        </main>
    );
}
