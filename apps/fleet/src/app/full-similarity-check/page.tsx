'use client';

import { useState, useEffect } from 'react';

interface Task {
  id: string;
  content: string;
  environment: string;
  createdBy: string;
  createdAt: string;
}

interface Project {
  id: string;
  name: string;
}

interface SimilarityResult {
  sourceTaskId: string;
  sourceContent: string;
  matches: Array<{
    taskId: string;
    content: string;
    environment: string;
    createdBy: string;
    similarity: number;
    createdAt: string;
  }>;
  debug?: {
    sourceHasEmbedding: boolean;
    totalComparisonTasks: number;
    tasksWithEmbeddings: number;
    matchesFound: number;
    maxSimilarity?: number;
    minSimilarity?: number;
    avgSimilarity?: number;
    top5Similarities?: number[];
  };
}

export default function FullSimilarityCheckPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [environmentFilter, setEnvironmentFilter] = useState<string>('');
  const [userFilter, setUserFilter] = useState<string>('');
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [selectedTaskIdForComparison, setSelectedTaskIdForComparison] = useState<string | null>(null);
  const [showCompareOptions, setShowCompareOptions] = useState(false);
  const [comparing, setComparing] = useState(false);
  const [similarityResults, setSimilarityResults] = useState<SimilarityResult[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 25;
  const [comparisonView, setComparisonView] = useState<{
    source: { id: string; content: string; environment: string; createdBy: string; createdAt: string };
    target: { id: string; content: string; environment: string; createdBy: string; createdAt: string; similarity: number };
  } | null>(null);
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [aiAnalysisLoading, setAiAnalysisLoading] = useState(false);
  const [aiAnalysisCost, setAiAnalysisCost] = useState<string | null>(null);

  // Fetch projects on mount
  useEffect(() => {
    fetchProjects();
  }, []);

  // Fetch tasks when project is selected
  useEffect(() => {
    if (selectedProjectId) {
      fetchTasks();
    }
  }, [selectedProjectId]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [environmentFilter, userFilter]);

  const fetchProjects = async () => {
    try {
      const res = await fetch('/api/projects');
      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else {
        setProjects(data.projects || []);
        if (data.projects && data.projects.length > 0) {
          setSelectedProjectId(data.projects[0].id);
        }
      }
    } catch (err) {
      console.error('Failed to fetch projects', err);
      setError('Failed to load projects');
    }
  };

  const fetchTasks = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/full-similarity-check?projectId=${selectedProjectId}`);
      const data = await res.json();
      if (data.error) {
        setError(data.error);
        setTasks([]);
      } else {
        setTasks(data.tasks || []);
        // Reset filters when new data is loaded
        setEnvironmentFilter('');
        setUserFilter('');
      }
    } catch (err) {
      console.error('Failed to fetch tasks', err);
      setError('Failed to load tasks');
      setTasks([]);
    } finally {
      setLoading(false);
    }
  };

  // Get unique environments and users for filter dropdowns
  const uniqueEnvironments = Array.from(new Set(tasks.map(t => t.environment))).sort();
  const uniqueUsers = Array.from(new Set(tasks.map(t => t.createdBy))).sort((a, b) => {
    // Helper to extract last name from display name
    const getLastName = (name: string) => {
      // If it's an email, return it as-is (will be sorted to end)
      if (name.includes('@')) return `zzz${name}`;

      // Split name into parts
      const parts = name.trim().split(/\s+/);

      // If only one part, return it
      if (parts.length === 1) return parts[0];

      // Return the last part (assumed to be last name)
      return parts[parts.length - 1];
    };

    const lastNameA = getLastName(a);
    const lastNameB = getLastName(b);

    // Sort by last name (case-insensitive)
    return lastNameA.localeCompare(lastNameB, undefined, { sensitivity: 'base' });
  });

  // Filter tasks based on selected filters
  const filteredTasks = tasks.filter(task => {
    const matchesEnvironment = !environmentFilter || task.environment === environmentFilter;
    const matchesUser = !userFilter || task.createdBy === userFilter;
    return matchesEnvironment && matchesUser;
  });

  // Pagination calculations
  const totalPages = Math.ceil(filteredTasks.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedTasks = filteredTasks.slice(startIndex, endIndex);

  const goToPage = (page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  };

  const comparePrompts = async (scope: 'environment' | 'all') => {
    if (!selectedTaskIdForComparison) return;

    setComparing(true);
    setShowCompareOptions(false);
    try {
      const res = await fetch('/api/full-similarity-check/compare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: selectedProjectId,
          taskIds: [selectedTaskIdForComparison],
          scope
        })
      });
      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else {
        setSimilarityResults(data.results || []);
      }
    } catch (err) {
      console.error('Failed to compare prompts', err);
      setError('Failed to compare prompts');
    } finally {
      setComparing(false);
    }
  };

  const fetchAiAnalysis = async (prompt1: string, prompt2: string) => {
    setAiAnalysisLoading(true);
    setAiAnalysis(null);
    setAiAnalysisCost(null);
    try {
      const res = await fetch('/api/full-similarity-check/ai-compare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt1, prompt2 })
      });
      const data = await res.json();
      if (data.error) {
        setAiAnalysis(`Error: ${data.error}`);
      } else {
        setAiAnalysis(data.analysis);
        setAiAnalysisCost(data.cost);
      }
    } catch (err) {
      console.error('Failed to fetch AI analysis', err);
      setAiAnalysis('Failed to fetch AI analysis. Please try again.');
    } finally {
      setAiAnalysisLoading(false);
    }
  };

  return (
    <>
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
      <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
        <h1 style={{ marginBottom: '1.5rem' }}>Full Similarity Check</h1>

      {/* Project Selector */}
      <div style={{ marginBottom: '2rem' }}>
        <label htmlFor="project-select" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
          Select Project:
        </label>
        <select
          id="project-select"
          value={selectedProjectId}
          onChange={(e) => setSelectedProjectId(e.target.value)}
          style={{
            padding: '0.5rem',
            fontSize: '1rem',
            borderRadius: '4px',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            backgroundColor: 'rgba(255, 255, 255, 0.05)',
            color: 'inherit',
            minWidth: '300px'
          }}
        >
          <option value="">-- Select a project --</option>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </select>
      </div>

      {/* Filters */}
      {!loading && tasks.length > 0 && (
        <div style={{
          display: 'flex',
          gap: '1rem',
          marginBottom: '1.5rem',
          padding: '1rem',
          backgroundColor: 'rgba(255, 255, 255, 0.03)',
          borderRadius: '8px',
          border: '1px solid rgba(255, 255, 255, 0.1)'
        }}>
          <div style={{ flex: 1 }}>
            <label htmlFor="environment-filter" style={{
              display: 'block',
              marginBottom: '0.5rem',
              fontSize: '0.875rem',
              fontWeight: 500,
              color: 'rgba(255, 255, 255, 0.7)'
            }}>
              Filter by Environment:
            </label>
            <select
              id="environment-filter"
              value={environmentFilter}
              onChange={(e) => setEnvironmentFilter(e.target.value)}
              style={{
                width: '100%',
                padding: '0.5rem',
                fontSize: '0.875rem',
                borderRadius: '4px',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                color: 'inherit'
              }}
            >
              <option value="">All Environments</option>
              {uniqueEnvironments.map((env) => (
                <option key={env} value={env}>
                  {env}
                </option>
              ))}
            </select>
          </div>

          <div style={{ flex: 1 }}>
            <label htmlFor="user-filter" style={{
              display: 'block',
              marginBottom: '0.5rem',
              fontSize: '0.875rem',
              fontWeight: 500,
              color: 'rgba(255, 255, 255, 0.7)'
            }}>
              Filter by User:
            </label>
            <select
              id="user-filter"
              value={userFilter}
              onChange={(e) => setUserFilter(e.target.value)}
              style={{
                width: '100%',
                padding: '0.5rem',
                fontSize: '0.875rem',
                borderRadius: '4px',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                color: 'inherit'
              }}
            >
              <option value="">All Users</option>
              {uniqueUsers.map((user) => (
                <option key={user} value={user}>
                  {user}
                </option>
              ))}
            </select>
          </div>

          {(environmentFilter || userFilter) && (
            <div style={{ display: 'flex', alignItems: 'flex-end' }}>
              <button
                onClick={() => {
                  setEnvironmentFilter('');
                  setUserFilter('');
                }}
                style={{
                  padding: '0.5rem 1rem',
                  fontSize: '0.875rem',
                  borderRadius: '4px',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  color: 'rgba(255, 255, 255, 0.7)',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap'
                }}
              >
                Clear Filters
              </button>
            </div>
          )}
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div style={{
          padding: '1rem',
          marginBottom: '1rem',
          backgroundColor: '#fee',
          color: '#c00',
          borderRadius: '4px'
        }}>
          {error}
        </div>
      )}

      {/* Loading State */}
      {loading && <p>Loading tasks...</p>}

      {/* Results Count and Selection Actions */}
      {!loading && tasks.length > 0 && (
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '1rem',
          gap: '1rem'
        }}>
          <div style={{
            fontSize: '0.875rem',
            color: 'rgba(255, 255, 255, 0.6)'
          }}>
            Showing {startIndex + 1}-{Math.min(endIndex, filteredTasks.length)} of {filteredTasks.length} tasks
            {filteredTasks.length !== tasks.length && ` (filtered from ${tasks.length})`}
          </div>
        </div>
      )}

      {/* Tasks Table */}
      {!loading && paginatedTasks.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{
            width: '100%',
            borderCollapse: 'collapse',
            border: '1px solid rgba(255, 255, 255, 0.1)'
          }}>
            <thead>
              <tr style={{
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                borderBottom: '2px solid rgba(255, 255, 255, 0.2)'
              }}>
                <th style={{
                  padding: '1rem 0.75rem',
                  textAlign: 'center',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  width: '1%',
                  whiteSpace: 'nowrap',
                  fontWeight: 600,
                  fontSize: '0.875rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: 'rgba(255, 255, 255, 0.9)'
                }}>
                  Action
                </th>
                <th style={{
                  padding: '1rem 0.75rem',
                  textAlign: 'left',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  fontWeight: 600,
                  fontSize: '0.875rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: 'rgba(255, 255, 255, 0.9)'
                }}>Content</th>
                <th style={{
                  padding: '1rem 0.75rem',
                  textAlign: 'left',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  width: '1%',
                  whiteSpace: 'nowrap',
                  fontWeight: 600,
                  fontSize: '0.875rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: 'rgba(255, 255, 255, 0.9)'
                }}>Environment</th>
                <th style={{
                  padding: '1rem 0.75rem',
                  textAlign: 'left',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  width: '1%',
                  whiteSpace: 'nowrap',
                  fontWeight: 600,
                  fontSize: '0.875rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: 'rgba(255, 255, 255, 0.9)'
                }}>Created By</th>
                <th style={{
                  padding: '1rem 0.75rem',
                  textAlign: 'left',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  width: '1%',
                  whiteSpace: 'nowrap',
                  fontWeight: 600,
                  fontSize: '0.875rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: 'rgba(255, 255, 255, 0.9)'
                }}>Created At</th>
              </tr>
            </thead>
            <tbody>
              {paginatedTasks.map((task) => (
                <tr key={task.id} style={{
                  borderBottom: '1px solid rgba(255, 255, 255, 0.05)'
                }}>
                  <td
                    style={{
                      padding: '0.75rem',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      textAlign: 'center',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    <button
                      onClick={() => {
                        setSelectedTaskIdForComparison(task.id);
                        setShowCompareOptions(true);
                      }}
                      disabled={comparing}
                      style={{
                        padding: '0.5rem 0.75rem',
                        fontSize: '0.75rem',
                        borderRadius: '4px',
                        border: '1px solid rgba(100, 200, 255, 0.5)',
                        backgroundColor: 'rgba(100, 200, 255, 0.1)',
                        color: 'rgba(100, 200, 255, 0.9)',
                        cursor: comparing ? 'not-allowed' : 'pointer',
                        opacity: comparing ? 0.5 : 1,
                        whiteSpace: 'nowrap'
                      }}
                    >
                      Use for comparison
                    </button>
                  </td>
                  <td
                    onClick={() => setSelectedTask(task)}
                    style={{
                      padding: '0.75rem',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      color: 'rgba(255, 255, 255, 0.8)',
                      cursor: 'pointer',
                      transition: 'background-color 0.2s',
                      maxWidth: '600px'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    {task.content.substring(0, 200)}{task.content.length > 200 ? '...' : ''}
                  </td>
                  <td style={{
                    padding: '0.75rem',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    color: 'rgba(255, 255, 255, 0.8)',
                    whiteSpace: 'nowrap'
                  }}>{task.environment}</td>
                  <td style={{
                    padding: '0.75rem',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    color: 'rgba(255, 255, 255, 0.8)',
                    whiteSpace: 'nowrap'
                  }}>{task.createdBy}</td>
                  <td style={{
                    padding: '0.75rem',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    color: 'rgba(255, 255, 255, 0.7)',
                    fontSize: '0.875rem',
                    whiteSpace: 'nowrap'
                  }}>
                    {new Date(task.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination Controls */}
      {!loading && filteredTasks.length > 0 && totalPages > 1 && (
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: '0.5rem',
          marginTop: '2rem',
          padding: '1rem',
          backgroundColor: 'rgba(255, 255, 255, 0.03)',
          borderRadius: '8px',
          border: '1px solid rgba(255, 255, 255, 0.1)'
        }}>
          <button
            onClick={() => goToPage(1)}
            disabled={currentPage === 1}
            style={{
              padding: '0.5rem 0.75rem',
              fontSize: '0.875rem',
              borderRadius: '4px',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              color: currentPage === 1 ? 'rgba(255, 255, 255, 0.3)' : 'rgba(255, 255, 255, 0.7)',
              cursor: currentPage === 1 ? 'not-allowed' : 'pointer'
            }}
          >
            First
          </button>
          <button
            onClick={() => goToPage(currentPage - 1)}
            disabled={currentPage === 1}
            style={{
              padding: '0.5rem 0.75rem',
              fontSize: '0.875rem',
              borderRadius: '4px',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              color: currentPage === 1 ? 'rgba(255, 255, 255, 0.3)' : 'rgba(255, 255, 255, 0.7)',
              cursor: currentPage === 1 ? 'not-allowed' : 'pointer'
            }}
          >
            Previous
          </button>

          <div style={{
            display: 'flex',
            gap: '0.25rem',
            alignItems: 'center'
          }}>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let pageNum;
              if (totalPages <= 5) {
                pageNum = i + 1;
              } else if (currentPage <= 3) {
                pageNum = i + 1;
              } else if (currentPage >= totalPages - 2) {
                pageNum = totalPages - 4 + i;
              } else {
                pageNum = currentPage - 2 + i;
              }

              return (
                <button
                  key={pageNum}
                  onClick={() => goToPage(pageNum)}
                  style={{
                    padding: '0.5rem 0.75rem',
                    fontSize: '0.875rem',
                    borderRadius: '4px',
                    border: currentPage === pageNum ? '1px solid rgba(100, 200, 255, 0.5)' : '1px solid rgba(255, 255, 255, 0.2)',
                    backgroundColor: currentPage === pageNum ? 'rgba(100, 200, 255, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                    color: currentPage === pageNum ? 'rgba(100, 200, 255, 0.9)' : 'rgba(255, 255, 255, 0.7)',
                    cursor: 'pointer',
                    minWidth: '2.5rem',
                    fontWeight: currentPage === pageNum ? 600 : 400
                  }}
                >
                  {pageNum}
                </button>
              );
            })}
          </div>

          <button
            onClick={() => goToPage(currentPage + 1)}
            disabled={currentPage === totalPages}
            style={{
              padding: '0.5rem 0.75rem',
              fontSize: '0.875rem',
              borderRadius: '4px',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              color: currentPage === totalPages ? 'rgba(255, 255, 255, 0.3)' : 'rgba(255, 255, 255, 0.7)',
              cursor: currentPage === totalPages ? 'not-allowed' : 'pointer'
            }}
          >
            Next
          </button>
          <button
            onClick={() => goToPage(totalPages)}
            disabled={currentPage === totalPages}
            style={{
              padding: '0.5rem 0.75rem',
              fontSize: '0.875rem',
              borderRadius: '4px',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              color: currentPage === totalPages ? 'rgba(255, 255, 255, 0.3)' : 'rgba(255, 255, 255, 0.7)',
              cursor: currentPage === totalPages ? 'not-allowed' : 'pointer'
            }}
          >
            Last
          </button>

          <div style={{
            marginLeft: '1rem',
            fontSize: '0.875rem',
            color: 'rgba(255, 255, 255, 0.6)'
          }}>
            Page {currentPage} of {totalPages}
          </div>
        </div>
      )}

      {/* No Results After Filtering */}
      {!loading && tasks.length > 0 && filteredTasks.length === 0 && (
        <div style={{
          padding: '2rem',
          textAlign: 'center',
          backgroundColor: 'rgba(255, 255, 255, 0.03)',
          borderRadius: '8px',
          border: '1px solid rgba(255, 255, 255, 0.1)'
        }}>
          <p style={{ color: 'rgba(255, 255, 255, 0.6)', marginBottom: '0.5rem' }}>
            No tasks match the selected filters.
          </p>
          <button
            onClick={() => {
              setEnvironmentFilter('');
              setUserFilter('');
            }}
            style={{
              padding: '0.5rem 1rem',
              fontSize: '0.875rem',
              borderRadius: '4px',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              color: 'rgba(255, 255, 255, 0.7)',
              cursor: 'pointer'
            }}
          >
            Clear Filters
          </button>
        </div>
      )}

      {/* Empty State */}
      {!loading && tasks.length === 0 && selectedProjectId && (
        <p style={{ color: 'rgba(255, 255, 255, 0.6)' }}>No tasks found for this project.</p>
      )}

      {/* No Project Selected */}
      {!loading && !selectedProjectId && (
        <p style={{ color: 'rgba(255, 255, 255, 0.6)' }}>Please select a project to view tasks.</p>
      )}

      {/* Task Detail Modal */}
      {selectedTask && (
        <div
          onClick={() => setSelectedTask(null)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '2rem'
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: 'rgba(10, 10, 15, 0.95)',
              borderRadius: '12px',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              maxWidth: '800px',
              width: '100%',
              maxHeight: '80vh',
              overflow: 'auto',
              padding: '2rem',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)'
            }}
          >
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              marginBottom: '1.5rem'
            }}>
              <h2 style={{
                fontSize: '1.5rem',
                fontWeight: 600,
                color: 'rgba(255, 255, 255, 0.9)',
                margin: 0
              }}>
                Task Details
              </h2>
              <button
                onClick={() => setSelectedTask(null)}
                style={{
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  borderRadius: '6px',
                  color: 'rgba(255, 255, 255, 0.7)',
                  cursor: 'pointer',
                  padding: '0.5rem 1rem',
                  fontSize: '0.875rem',
                  fontWeight: 500
                }}
              >
                Close
              </button>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <div style={{
                fontSize: '0.75rem',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                color: 'rgba(255, 255, 255, 0.5)',
                marginBottom: '0.5rem',
                fontWeight: 600
              }}>
                Content
              </div>
              <div style={{
                padding: '1rem',
                backgroundColor: 'rgba(255, 255, 255, 0.03)',
                borderRadius: '8px',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                color: 'rgba(255, 255, 255, 0.9)',
                lineHeight: '1.6',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word'
              }}>
                {selectedTask.content}
              </div>
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '1rem'
            }}>
              <div>
                <div style={{
                  fontSize: '0.75rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: 'rgba(255, 255, 255, 0.5)',
                  marginBottom: '0.5rem',
                  fontWeight: 600
                }}>
                  Environment
                </div>
                <div style={{
                  padding: '0.75rem',
                  backgroundColor: 'rgba(255, 255, 255, 0.03)',
                  borderRadius: '6px',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  color: 'rgba(255, 255, 255, 0.8)'
                }}>
                  {selectedTask.environment}
                </div>
              </div>

              <div>
                <div style={{
                  fontSize: '0.75rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: 'rgba(255, 255, 255, 0.5)',
                  marginBottom: '0.5rem',
                  fontWeight: 600
                }}>
                  Created By
                </div>
                <div style={{
                  padding: '0.75rem',
                  backgroundColor: 'rgba(255, 255, 255, 0.03)',
                  borderRadius: '6px',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  color: 'rgba(255, 255, 255, 0.8)'
                }}>
                  {selectedTask.createdBy}
                </div>
              </div>

              <div>
                <div style={{
                  fontSize: '0.75rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: 'rgba(255, 255, 255, 0.5)',
                  marginBottom: '0.5rem',
                  fontWeight: 600
                }}>
                  Created At
                </div>
                <div style={{
                  padding: '0.75rem',
                  backgroundColor: 'rgba(255, 255, 255, 0.03)',
                  borderRadius: '6px',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  color: 'rgba(255, 255, 255, 0.8)'
                }}>
                  {new Date(selectedTask.createdAt).toLocaleString()}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Compare Options Modal */}
      {showCompareOptions && (
        <div
          onClick={() => setShowCompareOptions(false)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '2rem'
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: 'rgba(10, 10, 15, 0.95)',
              borderRadius: '12px',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              maxWidth: '500px',
              width: '100%',
              padding: '2rem',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)'
            }}
          >
            <h2 style={{
              fontSize: '1.5rem',
              fontWeight: 600,
              color: 'rgba(255, 255, 255, 0.9)',
              marginBottom: '1rem'
            }}>
              Compare Selected Prompts
            </h2>
            <p style={{
              color: 'rgba(255, 255, 255, 0.6)',
              marginBottom: '2rem',
              lineHeight: '1.5'
            }}>
              Choose comparison scope for the selected prompt:
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <button
                onClick={() => comparePrompts('environment')}
                style={{
                  padding: '1rem',
                  fontSize: '1rem',
                  borderRadius: '8px',
                  border: '1px solid rgba(100, 200, 255, 0.3)',
                  backgroundColor: 'rgba(100, 200, 255, 0.1)',
                  color: 'rgba(255, 255, 255, 0.9)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(100, 200, 255, 0.2)';
                  e.currentTarget.style.borderColor = 'rgba(100, 200, 255, 0.5)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(100, 200, 255, 0.1)';
                  e.currentTarget.style.borderColor = 'rgba(100, 200, 255, 0.3)';
                }}
              >
                <strong>Within Same Environment</strong>
                <div style={{ fontSize: '0.875rem', color: 'rgba(255, 255, 255, 0.6)', marginTop: '0.25rem' }}>
                  Compare against all prompts in the same environment
                </div>
              </button>

              <button
                onClick={() => comparePrompts('all')}
                style={{
                  padding: '1rem',
                  fontSize: '1rem',
                  borderRadius: '8px',
                  border: '1px solid rgba(100, 200, 255, 0.3)',
                  backgroundColor: 'rgba(100, 200, 255, 0.1)',
                  color: 'rgba(255, 255, 255, 0.9)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(100, 200, 255, 0.2)';
                  e.currentTarget.style.borderColor = 'rgba(100, 200, 255, 0.5)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(100, 200, 255, 0.1)';
                  e.currentTarget.style.borderColor = 'rgba(100, 200, 255, 0.3)';
                }}
              >
                <strong>All Prompts in Project</strong>
                <div style={{ fontSize: '0.875rem', color: 'rgba(255, 255, 255, 0.6)', marginTop: '0.25rem' }}>
                  Compare against all prompts in the entire project
                </div>
              </button>

              <button
                onClick={() => setShowCompareOptions(false)}
                style={{
                  padding: '0.75rem',
                  fontSize: '0.875rem',
                  borderRadius: '6px',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  color: 'rgba(255, 255, 255, 0.7)',
                  cursor: 'pointer',
                  marginTop: '0.5rem'
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Similarity Results Modal */}
      {similarityResults.length > 0 && (
        <div
          onClick={() => setSimilarityResults([])}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '2rem'
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: 'rgba(10, 10, 15, 0.95)',
              borderRadius: '12px',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              maxWidth: '1000px',
              width: '100%',
              maxHeight: '80vh',
              overflow: 'auto',
              padding: '2rem',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)'
            }}
          >
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              marginBottom: '1.5rem'
            }}>
              <h2 style={{
                fontSize: '1.5rem',
                fontWeight: 600,
                color: 'rgba(255, 255, 255, 0.9)',
                margin: 0
              }}>
                Similarity Results (≥90%)
              </h2>
              <button
                onClick={() => setSimilarityResults([])}
                style={{
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  borderRadius: '6px',
                  color: 'rgba(255, 255, 255, 0.7)',
                  cursor: 'pointer',
                  padding: '0.5rem 1rem',
                  fontSize: '0.875rem',
                  fontWeight: 500
                }}
              >
                Close
              </button>
            </div>

            {similarityResults.map((result, idx) => (
              <div key={idx} style={{
                marginBottom: '2rem',
                padding: '1.5rem',
                backgroundColor: 'rgba(255, 255, 255, 0.03)',
                borderRadius: '8px',
                border: '1px solid rgba(255, 255, 255, 0.1)'
              }}>
                {/* Debug Info */}
                {result.debug && (
                  <div style={{
                    padding: '0.75rem',
                    marginBottom: '1rem',
                    backgroundColor: 'rgba(255, 200, 100, 0.1)',
                    borderRadius: '6px',
                    border: '1px solid rgba(255, 200, 100, 0.3)',
                    fontSize: '0.75rem',
                    color: 'rgba(255, 255, 255, 0.7)'
                  }}>
                    <strong>Debug Info:</strong>
                    <div>Source has embedding: {result.debug.sourceHasEmbedding ? '✅ Yes' : '❌ No'}</div>
                    <div>Total tasks in comparison set: {result.debug.totalComparisonTasks}</div>
                    <div>Tasks with embeddings: {result.debug.tasksWithEmbeddings}</div>
                    <div>Matches found (≥10%): {result.debug.matchesFound}</div>
                    {result.debug.maxSimilarity !== undefined && (
                      <>
                        <div style={{ marginTop: '0.5rem', fontWeight: 600 }}>Similarity Score Stats:</div>
                        <div>Max: {result.debug.maxSimilarity.toFixed(2)}%</div>
                        <div>Min: {result.debug.minSimilarity?.toFixed(2)}%</div>
                        <div>Avg: {result.debug.avgSimilarity?.toFixed(2)}%</div>
                        {result.debug.top5Similarities && result.debug.top5Similarities.length > 0 && (
                          <div>Top 5: {result.debug.top5Similarities.filter(s => s != null).map(s => s.toFixed(2) + '%').join(', ')}</div>
                        )}
                      </>
                    )}
                  </div>
                )}

                <div style={{
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  color: 'rgba(100, 200, 255, 0.8)',
                  marginBottom: '0.5rem'
                }}>
                  Source Prompt:
                </div>
                <div style={{
                  padding: '0.75rem',
                  backgroundColor: 'rgba(100, 200, 255, 0.05)',
                  borderRadius: '6px',
                  marginBottom: '1rem',
                  color: 'rgba(255, 255, 255, 0.8)',
                  fontSize: '0.875rem'
                }}>
                  {result.sourceContent.substring(0, 150)}{result.sourceContent.length > 150 ? '...' : ''}
                </div>

                {result.matches.length > 0 ? (
                  <div>
                    <div style={{
                      fontSize: '0.875rem',
                      fontWeight: 600,
                      color: 'rgba(255, 100, 100, 0.8)',
                      marginBottom: '0.75rem'
                    }}>
                      Found {result.matches.length} similar prompt{result.matches.length > 1 ? 's' : ''}:
                    </div>
                    {result.matches.map((match, mIdx) => {
                      const sourceTask = tasks.find(t => t.id === result.sourceTaskId);
                      const targetTask = tasks.find(t => t.id === match.taskId);
                      return (
                        <div
                          key={mIdx}
                          onClick={() => {
                            if (sourceTask && targetTask) {
                              setComparisonView({
                                source: {
                                  id: result.sourceTaskId,
                                  content: result.sourceContent,
                                  environment: sourceTask.environment,
                                  createdBy: sourceTask.createdBy,
                                  createdAt: sourceTask.createdAt
                                },
                                target: {
                                  id: match.taskId,
                                  content: match.content,
                                  environment: match.environment,
                                  createdBy: match.createdBy,
                                  createdAt: targetTask.createdAt,
                                  similarity: match.similarity
                                }
                              });
                              fetchAiAnalysis(result.sourceContent, match.content);
                            }
                          }}
                          style={{
                            padding: '1rem',
                            marginBottom: '0.75rem',
                            backgroundColor: 'rgba(255, 100, 100, 0.05)',
                            borderRadius: '6px',
                            border: '1px solid rgba(255, 100, 100, 0.2)',
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = 'rgba(255, 100, 100, 0.1)';
                            e.currentTarget.style.borderColor = 'rgba(255, 100, 100, 0.4)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'rgba(255, 100, 100, 0.05)';
                            e.currentTarget.style.borderColor = 'rgba(255, 100, 100, 0.2)';
                          }}
                        >
                          <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            marginBottom: '0.5rem'
                          }}>
                            <span style={{
                              fontSize: '0.75rem',
                              color: 'rgba(255, 255, 255, 0.5)'
                            }}>
                              {match.environment} • {match.createdBy}
                            </span>
                            <span style={{
                              fontSize: '0.875rem',
                              fontWeight: 600,
                              color: match.similarity >= 95 ? 'rgba(255, 80, 80, 0.9)' : 'rgba(255, 150, 150, 0.9)'
                            }}>
                              {match.similarity.toFixed(1)}% similar
                            </span>
                          </div>
                          <div style={{
                            fontSize: '0.875rem',
                            color: 'rgba(255, 255, 255, 0.7)',
                            lineHeight: '1.4'
                          }}>
                            {match.content.substring(0, 200)}{match.content.length > 200 ? '...' : ''}
                          </div>
                          <div style={{
                            fontSize: '0.75rem',
                            color: 'rgba(100, 200, 255, 0.7)',
                            marginTop: '0.5rem',
                            fontStyle: 'italic'
                          }}>
                            Click to compare side-by-side →
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div style={{
                    padding: '1rem',
                    textAlign: 'center',
                    color: 'rgba(255, 255, 255, 0.5)',
                    fontSize: '0.875rem'
                  }}>
                    No similar prompts found (≥90% threshold)
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Side-by-Side Comparison Modal */}
      {comparisonView && (
        <div
          onClick={() => {
            setComparisonView(null);
            setAiAnalysis(null);
            setAiAnalysisCost(null);
          }}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.85)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1001,
            padding: '2rem'
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: 'rgba(10, 10, 15, 0.98)',
              borderRadius: '12px',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              maxWidth: '1400px',
              width: '100%',
              maxHeight: '90vh',
              overflow: 'auto',
              padding: '2rem',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)'
            }}
          >
            {/* Header */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '1.5rem',
              paddingBottom: '1rem',
              borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
            }}>
              <h2 style={{
                fontSize: '1.5rem',
                fontWeight: 600,
                color: 'rgba(255, 255, 255, 0.9)',
                margin: 0
              }}>
                Side-by-Side Comparison
              </h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{
                  padding: '0.5rem 1rem',
                  backgroundColor: comparisonView.target.similarity >= 95
                    ? 'rgba(255, 80, 80, 0.2)'
                    : 'rgba(255, 150, 150, 0.2)',
                  borderRadius: '20px',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  color: comparisonView.target.similarity >= 95
                    ? 'rgba(255, 80, 80, 0.9)'
                    : 'rgba(255, 150, 150, 0.9)'
                }}>
                  {comparisonView.target.similarity.toFixed(1)}% Similar
                </div>
                <button
                  onClick={() => {
                    setComparisonView(null);
                    setAiAnalysis(null);
                    setAiAnalysisCost(null);
                  }}
                  style={{
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    borderRadius: '6px',
                    color: 'rgba(255, 255, 255, 0.7)',
                    cursor: 'pointer',
                    padding: '0.5rem 1rem',
                    fontSize: '0.875rem',
                    fontWeight: 500
                  }}
                >
                  Close
                </button>
              </div>
            </div>

            {/* Side-by-Side Content */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '2rem'
            }}>
              {/* Source Prompt */}
              <div style={{
                padding: '1.5rem',
                backgroundColor: 'rgba(100, 200, 255, 0.05)',
                borderRadius: '8px',
                border: '1px solid rgba(100, 200, 255, 0.2)'
              }}>
                <div style={{
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: 'rgba(100, 200, 255, 0.9)',
                  marginBottom: '1rem'
                }}>
                  Source Prompt
                </div>

                {/* Content */}
                <div style={{
                  padding: '1rem',
                  backgroundColor: 'rgba(255, 255, 255, 0.03)',
                  borderRadius: '6px',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  marginBottom: '1rem',
                  minHeight: '200px'
                }}>
                  <div style={{
                    fontSize: '0.875rem',
                    color: 'rgba(255, 255, 255, 0.9)',
                    lineHeight: '1.6',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word'
                  }}>
                    {comparisonView.source.content}
                  </div>
                </div>

                {/* Metadata */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <div>
                    <div style={{
                      fontSize: '0.7rem',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      color: 'rgba(255, 255, 255, 0.4)',
                      marginBottom: '0.25rem'
                    }}>
                      Environment
                    </div>
                    <div style={{
                      fontSize: '0.875rem',
                      color: 'rgba(255, 255, 255, 0.8)'
                    }}>
                      {comparisonView.source.environment}
                    </div>
                  </div>
                  <div>
                    <div style={{
                      fontSize: '0.7rem',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      color: 'rgba(255, 255, 255, 0.4)',
                      marginBottom: '0.25rem'
                    }}>
                      Created By
                    </div>
                    <div style={{
                      fontSize: '0.875rem',
                      color: 'rgba(255, 255, 255, 0.8)'
                    }}>
                      {comparisonView.source.createdBy}
                    </div>
                  </div>
                  <div>
                    <div style={{
                      fontSize: '0.7rem',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      color: 'rgba(255, 255, 255, 0.4)',
                      marginBottom: '0.25rem'
                    }}>
                      Created At
                    </div>
                    <div style={{
                      fontSize: '0.875rem',
                      color: 'rgba(255, 255, 255, 0.8)'
                    }}>
                      {new Date(comparisonView.source.createdAt).toLocaleString()}
                    </div>
                  </div>
                </div>
              </div>

              {/* Similar Prompt */}
              <div style={{
                padding: '1.5rem',
                backgroundColor: 'rgba(255, 100, 100, 0.05)',
                borderRadius: '8px',
                border: '1px solid rgba(255, 100, 100, 0.2)'
              }}>
                <div style={{
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: 'rgba(255, 100, 100, 0.9)',
                  marginBottom: '1rem'
                }}>
                  Similar Prompt
                </div>

                {/* Content */}
                <div style={{
                  padding: '1rem',
                  backgroundColor: 'rgba(255, 255, 255, 0.03)',
                  borderRadius: '6px',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  marginBottom: '1rem',
                  minHeight: '200px'
                }}>
                  <div style={{
                    fontSize: '0.875rem',
                    color: 'rgba(255, 255, 255, 0.9)',
                    lineHeight: '1.6',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word'
                  }}>
                    {comparisonView.target.content}
                  </div>
                </div>

                {/* Metadata */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <div>
                    <div style={{
                      fontSize: '0.7rem',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      color: 'rgba(255, 255, 255, 0.4)',
                      marginBottom: '0.25rem'
                    }}>
                      Environment
                    </div>
                    <div style={{
                      fontSize: '0.875rem',
                      color: 'rgba(255, 255, 255, 0.8)'
                    }}>
                      {comparisonView.target.environment}
                    </div>
                  </div>
                  <div>
                    <div style={{
                      fontSize: '0.7rem',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      color: 'rgba(255, 255, 255, 0.4)',
                      marginBottom: '0.25rem'
                    }}>
                      Created By
                    </div>
                    <div style={{
                      fontSize: '0.875rem',
                      color: 'rgba(255, 255, 255, 0.8)'
                    }}>
                      {comparisonView.target.createdBy}
                    </div>
                  </div>
                  <div>
                    <div style={{
                      fontSize: '0.7rem',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      color: 'rgba(255, 255, 255, 0.4)',
                      marginBottom: '0.25rem'
                    }}>
                      Created At
                    </div>
                    <div style={{
                      fontSize: '0.875rem',
                      color: 'rgba(255, 255, 255, 0.8)'
                    }}>
                      {new Date(comparisonView.target.createdAt).toLocaleString()}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* AI Analysis Section */}
            <div style={{
              marginTop: '2rem',
              padding: '1.5rem',
              backgroundColor: 'rgba(120, 80, 255, 0.05)',
              borderRadius: '8px',
              border: '1px solid rgba(120, 80, 255, 0.2)'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '1rem'
              }}>
                <div style={{
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: 'rgba(120, 80, 255, 0.9)'
                }}>
                  AI Similarity Analysis
                </div>
                {aiAnalysisCost && (
                  <div style={{
                    fontSize: '0.75rem',
                    color: 'rgba(255, 255, 255, 0.5)',
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    padding: '0.25rem 0.75rem',
                    borderRadius: '12px'
                  }}>
                    Cost: {aiAnalysisCost}
                  </div>
                )}
              </div>
              <div style={{
                padding: '1rem',
                backgroundColor: 'rgba(255, 255, 255, 0.03)',
                borderRadius: '6px',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                minHeight: '100px'
              }}>
                {aiAnalysisLoading ? (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '2rem',
                    color: 'rgba(255, 255, 255, 0.6)'
                  }}>
                    <div style={{
                      animation: 'spin 1s linear infinite',
                      width: '24px',
                      height: '24px',
                      border: '3px solid rgba(120, 80, 255, 0.2)',
                      borderTopColor: 'rgba(120, 80, 255, 0.8)',
                      borderRadius: '50%',
                      marginRight: '0.75rem'
                    }} />
                    Analyzing similarities with AI...
                  </div>
                ) : aiAnalysis ? (
                  <div style={{
                    fontSize: '0.875rem',
                    color: 'rgba(255, 255, 255, 0.9)',
                    lineHeight: '1.6',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word'
                  }}>
                    {aiAnalysis}
                  </div>
                ) : (
                  <div style={{
                    fontSize: '0.875rem',
                    color: 'rgba(255, 255, 255, 0.5)',
                    textAlign: 'center',
                    padding: '1rem'
                  }}>
                    Loading AI analysis...
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      </div>
    </>
  );
}
