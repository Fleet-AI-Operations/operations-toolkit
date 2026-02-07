'use client';

import { useState, useEffect } from 'react';
import { Folder, Plus, Trash2, LayoutDashboard, FileText, Upload, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';
import { useProjectContext } from '@/context/ProjectContext';

interface Project {
    id: string;
    name: string;
    guidelinesFileName?: string | null;
    createdAt: string;
}

export default function ManagementPage() {
    const [projects, setProjects] = useState<Project[]>([]);
    const [loading, setLoading] = useState(true);
    const [newName, setNewName] = useState('');
    const [showNewProject, setShowNewProject] = useState(false);
    const [uploadingId, setUploadingId] = useState<string | null>(null);
    const { refreshProjects: refreshGlobalProjects } = useProjectContext();

    useEffect(() => {
        fetchProjects();
    }, []);

    const fetchProjects = async () => {
        try {
            const res = await fetch('/api/projects');
            const data = await res.json();
            const projectList = Array.isArray(data) ? data : (data.projects || []);
            setProjects(projectList);
        } catch (err) {
            console.error('Failed to fetch projects', err);
            setProjects([]);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateProject = async () => {
        if (!newName) {
            return;
        }
        try {
            const res = await fetch('/api/projects', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: newName }),
            });

            if (!res.ok) {
                const errorData = await res.json();
                alert(`Failed to create project: ${errorData.error || 'Unknown error'}`);
                return;
            }

            await fetchProjects();
            await refreshGlobalProjects(); // Update the global project selector
            setNewName('');
            setShowNewProject(false);
        } catch (err) {
            console.error('Failed to create project:', err);
            alert('Failed to create project: ' + (err instanceof Error ? err.message : String(err)));
        }
    };

    const deleteProject = async (id: string) => {
        if (!confirm('Are you sure? This will delete all data records for this project.')) return;
        try {
            await fetch(`/api/projects?id=${id}`, { method: 'DELETE' });
            await fetchProjects();
            await refreshGlobalProjects(); // Update the global project selector
        } catch (err) {
            alert('Failed to delete project');
        }
    };

    const handleFileUpload = async (projectId: string, file: File) => {
        if (file.type !== 'application/pdf') {
            alert('Please upload a PDF file.');
            return;
        }

        setUploadingId(projectId);

        const reader = new FileReader();
        reader.onload = async (e) => {
            const base64 = e.target?.result as string;
            try {
                const res = await fetch('/api/projects', {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        id: projectId,
                        guidelines: base64,
                        guidelinesFileName: file.name
                    }),
                });

                if (res.ok) {
                    await fetchProjects();
                } else {
                    const errorData = await res.json();
                    alert(`Upload failed: ${errorData.error || 'Unknown error'}`);
                }
            } catch (err) {
                console.error(err);
                alert('Upload failed');
            } finally {
                setUploadingId(null);
            }
        };
        reader.readAsDataURL(file);
    };

    return (
        <div style={{ width: '100%', maxWidth: '1200px', margin: '0 auto' }}>
            <div style={{ marginBottom: '40px' }}>
                <h1 className="premium-gradient" style={{ fontSize: '2.5rem', marginBottom: '8px' }}>Project Management</h1>
                <p style={{ color: 'rgba(255,255,255,0.6)' }}>Configure Task Data Projects</p>
            </div>

            <section className="glass-card" style={{ marginBottom: '32px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                    <h2 style={{ fontSize: '1.5rem', display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <Folder color="#0070f3" /> Projects
                    </h2>
                    <button className="btn-primary" onClick={() => setShowNewProject(true)}>
                        <Plus size={18} style={{ marginRight: '8px' }} /> New Project
                    </button>
                </div>

                {showNewProject && (
                    <div className="glass-card" style={{ background: 'rgba(255,255,255,0.05)', marginBottom: '24px' }}>
                        <h3>Add New Project</h3>
                        <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
                            <input
                                type="text"
                                className="input-field"
                                placeholder="Project Name"
                                value={newName}
                                onChange={(e) => setNewName(e.target.value)}
                            />
                            <button className="btn-primary" onClick={handleCreateProject}>Create</button>
                            <button onClick={() => setShowNewProject(false)}>Cancel</button>
                        </div>
                    </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))', gap: '24px' }}>
                    {projects.map(project => (
                        <div key={project.id} className="glass-card" style={{ background: 'rgba(255,255,255,0.02)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <div style={{ flex: 1 }}>
                                    <h3 style={{ fontSize: '1.2rem', marginBottom: '4px' }}>{project.name}</h3>
                                    <span style={{ fontSize: '0.7rem', opacity: 0.4 }}>ID: {project.id}</span>

                                    <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                                            <FileText size={14} color="var(--accent)" />
                                            <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Guidelines PDF</span>
                                        </div>

                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                            {project.guidelinesFileName ? (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', background: 'rgba(0, 255, 136, 0.1)', color: '#00ff88', padding: '4px 10px', borderRadius: '4px' }}>
                                                    <CheckCircle2 size={12} />
                                                    {project.guidelinesFileName}
                                                </div>
                                            ) : (
                                                <span style={{ fontSize: '0.75rem', opacity: 0.4 }}>No guidelines uploaded</span>
                                            )}

                                            <label className="btn-primary" style={{
                                                fontSize: '0.7rem',
                                                padding: '4px 8px',
                                                cursor: 'pointer',
                                                background: 'rgba(255,255,255,0.05)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '4px'
                                            }}>
                                                {uploadingId === project.id ? 'Uploading...' : (
                                                    <><Upload size={12} /> {project.guidelinesFileName ? 'Replace' : 'Upload'}</>
                                                )}
                                                <input
                                                    type="file"
                                                    accept=".pdf"
                                                    style={{ display: 'none' }}
                                                    onChange={(e) => e.target.files?.[0] && handleFileUpload(project.id, e.target.files[0])}
                                                    disabled={uploadingId === project.id}
                                                />
                                            </label>
                                        </div>
                                    </div>

                                    <p style={{ fontSize: '0.75rem', opacity: 0.6, marginTop: '16px' }}>
                                        Created: {new Date(project.createdAt).toLocaleDateString()}
                                    </p>
                                </div>
                                <button onClick={() => deleteProject(project.id)} style={{ color: 'var(--error)', opacity: 0.6 }}>
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        </div>
                    ))}
                    {projects.length === 0 && !loading && (
                        <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '40px', opacity: 0.5 }}>
                            No projects found. Create one to get started.
                        </div>
                    )}
                </div>
            </section>
        </div>
    );
}
