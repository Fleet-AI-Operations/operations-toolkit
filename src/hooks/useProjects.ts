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

    return {
        projects,
        selectedProjectId,
        setSelectedProjectId,
        loading,
        error,
        refetch: refreshProjects
    };
}
