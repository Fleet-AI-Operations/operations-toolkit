'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

export interface Project {
    id: string;
    name: string;
}

interface ProjectContextType {
    projects: Project[];
    selectedProjectId: string;
    setSelectedProjectId: (id: string) => void;
    loading: boolean;
    error: string | null;
    refreshProjects: () => Promise<void>;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

export function ProjectProvider({ children }: { children: React.ReactNode }) {
    const [projects, setProjects] = useState<Project[]>([]);
    const [selectedProjectId, setSelectedProjectId] = useState<string>('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchProjects = useCallback(async () => {
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
                
                // If we have projects and none is selected, select the first one
                // We also check if the current selection is still valid
                if (data.length > 0) {
                    if (!selectedProjectId || !data.find(p => p.id === selectedProjectId)) {
                        setSelectedProjectId(data[0].id);
                    }
                }
            } else {
                throw new Error('Invalid response format');
            }
        } catch (err) {
            console.error('Failed to fetch projects:', err);
            setError(err instanceof Error ? err.message : 'Failed to fetch projects');
        } finally {
            setLoading(false);
        }
    }, [selectedProjectId]);

    useEffect(() => {
        fetchProjects();
    }, []);

    return (
        <ProjectContext.Provider value={{
            projects,
            selectedProjectId,
            setSelectedProjectId,
            loading,
            error,
            refreshProjects: fetchProjects
        }}>
            {children}
        </ProjectContext.Provider>
    );
}

export function useProjectContext() {
    const context = useContext(ProjectContext);
    if (context === undefined) {
        throw new Error('useProjectContext must be used within a ProjectProvider');
    }
    return context;
}
