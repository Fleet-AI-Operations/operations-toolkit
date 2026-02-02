import { useEffect } from 'react';
import { useProjectContext } from '@/context/ProjectContext';

export interface Project {
    id: string;
    name: string;
}

interface UseProjectsOptions {
    autoSelectFirst?: boolean;
    initialProjectId?: string;
}

export function useProjects(options: UseProjectsOptions = {}) {
    const {
        projects,
        selectedProjectId,
        setSelectedProjectId,
        loading,
        error,
        refreshProjects
    } = useProjectContext();

    // Handle initialProjectId option - set it once projects are loaded
    useEffect(() => {
        if (!loading && projects.length > 0 && options.initialProjectId) {
            const projectExists = projects.find(p => p.id === options.initialProjectId);
            if (projectExists && selectedProjectId !== options.initialProjectId) {
                setSelectedProjectId(options.initialProjectId);
            }
        }
    }, [loading, projects, options.initialProjectId, selectedProjectId, setSelectedProjectId]);

    return {
        projects,
        selectedProjectId,
        setSelectedProjectId,
        loading,
        error,
        refetch: refreshProjects
    };
}
