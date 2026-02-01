import { useState, useEffect } from 'react';

export interface Project {
    id: string;
    name: string;
}

interface UseProjectsOptions {
    autoSelectFirst?: boolean;
    initialProjectId?: string;
}

export function useProjects(options: UseProjectsOptions = {}) {
    const { autoSelectFirst = true, initialProjectId = '' } = options;

    const [projects, setProjects] = useState<Project[]>([]);
    const [selectedProjectId, setSelectedProjectId] = useState<string>(initialProjectId);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchProjects();
    }, []);

    const fetchProjects = async () => {
        try {
            setLoading(true);
            setError(null);
            const res = await fetch('/api/projects');

            if (!res.ok) {
                throw new Error(`Failed to fetch projects: ${res.status}`);
            }

            const data = await res.json();
            if (Array.isArray(data)) {
                setProjects(data);
                // Auto-select first project if enabled and no project is selected
                if (autoSelectFirst && !selectedProjectId && data.length > 0) {
                    setSelectedProjectId(data[0].id);
                }
            } else {
                throw new Error('Invalid response format');
            }
        } catch (err) {
            console.error('Failed to fetch projects', err);
            setError(err instanceof Error ? err.message : 'Failed to fetch projects');
        } finally {
            setLoading(false);
        }
    };

    return {
        projects,
        selectedProjectId,
        setSelectedProjectId,
        loading,
        error,
        refetch: fetchProjects
    };
}
