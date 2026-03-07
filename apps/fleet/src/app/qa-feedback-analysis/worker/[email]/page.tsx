'use client'

import React, { useState, useEffect } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft, BarChart3, Calendar, X } from 'lucide-react'

interface WorkerStats {
    qaEmail: string;
    qaName: string | null;
    totalRatings: number;
    positiveRatings: number;
    negativeRatings: number;
    negativePercent: number;
    disputes: number;
    totalFeedbacks: number;
    negativePerFeedbackRatio: number;
}

interface EnvStats {
    environment: string;
    totalRatings: number;
    positiveRatings: number;
    negativeRatings: number;
    negativePercent: number;
}

interface MonthStats {
    month: string;
    totalRatings: number;
    positiveRatings: number;
    negativeRatings: number;
    negativePercent: number;
}

interface TaskRating {
    taskId: string;
    taskContent: string;
    taskEnvironment: string | null;
    taskCreatedAt: string;
    ratingId: string;
    feedbackContent: string | null;
    isHelpful: boolean;
    isDispute: boolean;
    ratedAt: string;
    raterEmail: string;
}

interface TaskDetails {
    id: string;
    content: string;
    environment: string | null;
    createdAt: string;
    createdByEmail: string | null;
    createdByName: string | null;
}

interface RelatedTask {
    id: string;
    content: string;
    environment: string | null;
    createdAt: string;
}

interface FeedbackWithRating {
    feedbackId: string;
    feedbackContent: string;
    feedbackCreatedAt: string;
    qaEmail: string | null;
    qaName: string | null;
    ratingId: string | null;
    isHelpful: boolean | null;
    isDispute: boolean | null;
    ratedAt: string | null;
    raterEmail: string | null;
}

export default function WorkerDetailsPage() {
    const params = useParams()
    const router = useRouter()
    const searchParams = useSearchParams()
    const qaEmail = decodeURIComponent(params.email as string)

    const [workerDetails, setWorkerDetails] = useState<{
        worker: WorkerStats;
        ratingsByEnvironment: EnvStats[];
        ratingsByMonth: MonthStats[];
        tasks: TaskRating[];
    } | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [taskFilter, setTaskFilter] = useState<'all' | 'positive' | 'negative' | 'disputed'>('all')

    // State for task history modal
    const [selectedTask, setSelectedTask] = useState<string | null>(null)
    const [taskHistory, setTaskHistory] = useState<{
        task: TaskDetails;
        relatedTasks: RelatedTask[];
        allFeedbacks: FeedbackWithRating[];
    } | null>(null)
    const [historyLoading, setHistoryLoading] = useState(false)

    useEffect(() => {
        fetchWorkerDetails()
    }, [qaEmail])

    // Escape key to close modal
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && selectedTask) {
                setSelectedTask(null)
            }
        }
        document.addEventListener('keydown', handleKeyDown)
        return () => document.removeEventListener('keydown', handleKeyDown)
    }, [selectedTask])

    const fetchWorkerDetails = async () => {
        setIsLoading(true)
        try {
            const params = new URLSearchParams({ qaEmail })

            const startDate = searchParams.get('startDate')
            const endDate = searchParams.get('endDate')
            const environment = searchParams.get('environment')

            if (startDate) params.set('startDate', startDate)
            if (endDate) params.set('endDate', endDate)
            if (environment) params.set('environment', environment)

            const response = await fetch(`/api/qa-feedback-analysis/worker-details?${params}`)
            const data = await response.json()

            if (response.ok) {
                setWorkerDetails(data)
            }
        } catch (err) {
            console.error('Failed to fetch worker details:', err)
        } finally {
            setIsLoading(false)
        }
    }

    // Fetch task history for modal
    const openTaskHistory = async (taskId: string) => {
        setSelectedTask(taskId)
        setHistoryLoading(true)
        setTaskHistory(null)

        try {
            const params = new URLSearchParams({ taskId })
            const response = await fetch(`/api/qa-feedback-analysis/task-history?${params}`)
            const data = await response.json()

            if (response.ok) {
                setTaskHistory(data)
            }
        } catch (err) {
            console.error('Failed to fetch task history:', err)
        } finally {
            setHistoryLoading(false)
        }
    }

    // Filter tasks
    const filteredTasks = workerDetails?.tasks.filter(task => {
        if (taskFilter === 'all') return true
        if (taskFilter === 'positive') return task.isHelpful
        if (taskFilter === 'negative') return !task.isHelpful
        if (taskFilter === 'disputed') return task.isDispute
        return true
    }) || []

    const taskFilters: { label: string; value: typeof taskFilter }[] = [
        { label: 'All', value: 'all' },
        { label: 'Positive', value: 'positive' },
        { label: 'Negative', value: 'negative' },
        { label: 'Disputed', value: 'disputed' },
    ]

    return (
        <div className="page-container">
            {/* Header */}
            <div className="mb-8">
                <button
                    onClick={() => router.back()}
                    className="btn-secondary mb-4 inline-flex items-center gap-2"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Back to QA Workers
                </button>

                <h1 style={{ fontSize: '2rem' }}>
                    <span className="premium-gradient">
                        {workerDetails?.worker.qaName || qaEmail}
                    </span>
                </h1>
                <p className="text-[var(--text-secondary)] mt-2">
                    Detailed performance analysis for this QA worker
                </p>
            </div>

            {isLoading && (
                <div className="glass-card text-center py-12">
                    <div className="animate-spin h-8 w-8 border-4 border-[var(--accent)] border-t-transparent rounded-full mx-auto mb-4" />
                    <p className="text-[var(--text-secondary)]">Loading worker details...</p>
                </div>
            )}

            {workerDetails && !isLoading && (
                <>
                    {/* Worker Summary */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '24px' }}>
                        <div className="glass-card">
                            <div className="text-sm text-[var(--text-secondary)] mb-1">Total Ratings</div>
                            <div className="text-2xl font-bold">{workerDetails.worker.totalRatings}</div>
                            <div className="mt-2 h-2 bg-[var(--bg-primary)] rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-green-500"
                                    style={{ width: `${(workerDetails.worker.positiveRatings / workerDetails.worker.totalRatings) * 100}%` }}
                                />
                            </div>
                        </div>

                        <div className="glass-card">
                            <div className="text-sm text-[var(--text-secondary)] mb-1">Negative %</div>
                            <div className={`text-2xl font-bold ${workerDetails.worker.negativePercent > 25 ? 'text-red-500' : workerDetails.worker.negativePercent > 15 ? 'text-orange-500' : 'text-green-500'}`}>
                                {workerDetails.worker.negativePercent.toFixed(1)}%
                            </div>
                            <div className="text-sm text-[var(--text-secondary)] mt-1">
                                {workerDetails.worker.negativeRatings} / {workerDetails.worker.totalRatings} negative
                            </div>
                        </div>

                        <div className="glass-card">
                            <div className="text-sm text-[var(--text-secondary)] mb-1">Total Feedbacks</div>
                            <div className="text-2xl font-bold">{workerDetails.worker.totalFeedbacks}</div>
                            <div className="text-sm text-[var(--text-secondary)] mt-1">
                                Ratio: {workerDetails.worker.negativePerFeedbackRatio.toFixed(3)}
                            </div>
                        </div>
                    </div>

                    {/* Environment Breakdown and Timeline */}
                    {(workerDetails.ratingsByEnvironment.length > 0 || workerDetails.ratingsByMonth.length > 0) && (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
                            {/* Environment Breakdown */}
                            {workerDetails.ratingsByEnvironment.length > 0 && (
                                <div className="glass-card">
                                    <h3 className="font-semibold mb-3 flex items-center gap-2">
                                        <BarChart3 className="w-5 h-5" />
                                        Environment Breakdown
                                    </h3>
                                    <div className="space-y-3 max-h-64 overflow-y-auto">
                                        {workerDetails.ratingsByEnvironment.map((envStat) => (
                                            <div key={envStat.environment} className="bg-[var(--bg-secondary)] p-3 rounded-lg">
                                                <div className="flex items-center justify-between mb-2">
                                                    <span className="font-medium">{envStat.environment}</span>
                                                    <span className="text-sm text-[var(--text-secondary)]">
                                                        {envStat.totalRatings} ratings
                                                    </span>
                                                </div>
                                                <div className="h-6 bg-[var(--bg-primary)] rounded-full overflow-hidden">
                                                    <div
                                                        className="h-full bg-green-500"
                                                        style={{ width: `${(envStat.positiveRatings / envStat.totalRatings) * 100}%` }}
                                                    />
                                                </div>
                                                <div className="text-sm text-[var(--text-secondary)] mt-1">
                                                    <span className="text-red-500">{envStat.negativePercent.toFixed(1)}%</span> negative
                                                    ({envStat.negativeRatings}/{envStat.totalRatings})
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Timeline */}
                            {workerDetails.ratingsByMonth.length > 0 && (
                                <div className="glass-card">
                                    <h3 className="font-semibold mb-3 flex items-center gap-2">
                                        <Calendar className="w-5 h-5" />
                                        Timeline
                                    </h3>
                                    <div className="space-y-2 max-h-64 overflow-y-auto">
                                        {workerDetails.ratingsByMonth.map((monthStat) => (
                                            <div key={monthStat.month} className="flex items-center gap-4">
                                                <div className="w-20 text-sm">{monthStat.month}</div>
                                                <div className="flex-1 bg-[var(--bg-secondary)] rounded-full h-4 overflow-hidden">
                                                    <div
                                                        className="h-full bg-red-500"
                                                        style={{ width: `${monthStat.negativePercent}%` }}
                                                    />
                                                </div>
                                                <div className="text-sm w-20 text-right">
                                                    <span className="text-red-500">{monthStat.negativePercent.toFixed(1)}%</span>
                                                </div>
                                                <div className="text-sm text-[var(--text-secondary)] w-24 text-right">
                                                    {monthStat.totalRatings} ratings
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Task List */}
                    <div className="glass-card">
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="font-semibold">Rated Tasks ({filteredTasks.length})</h3>
                            <div className="flex gap-2">
                                {taskFilters.map(({ label, value }) => (
                                    <button
                                        key={value}
                                        onClick={() => setTaskFilter(value)}
                                        className={taskFilter === value ? 'btn-primary text-sm' : 'text-sm px-4 py-2 rounded-lg border border-[var(--border)] text-[var(--text-secondary)] hover:text-white hover:border-[var(--accent)] transition-colors'}
                                    >
                                        {label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-3 max-h-[600px] overflow-y-auto">
                            {filteredTasks.map((task) => (
                                <div
                                    key={task.ratingId}
                                    className="glass-card cursor-pointer transition-all duration-200 hover:border-[var(--accent)]"
                                    onClick={() => openTaskHistory(task.taskId)}
                                    style={{ padding: '16px' }}
                                >
                                    <div className="flex items-start justify-between mb-3">
                                        <div className="flex-1 pr-4">
                                            <div className="font-medium mb-2 leading-relaxed">{task.taskContent}</div>
                                            <div className="text-sm text-[var(--text-secondary)]">
                                                {task.taskEnvironment || 'Unknown environment'} • {new Date(task.taskCreatedAt).toLocaleDateString()}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 flex-shrink-0">
                                            {task.isDispute && (
                                                <span className="px-2 py-1 bg-yellow-500/20 text-yellow-500 text-xs rounded font-medium">
                                                    Disputed
                                                </span>
                                            )}
                                            <span className={`px-3 py-1 text-xs rounded font-medium ${task.isHelpful ? 'bg-green-500/20 text-green-500' : 'bg-red-500/20 text-red-500'}`}>
                                                {task.isHelpful ? 'Positive' : 'Negative'}
                                            </span>
                                        </div>
                                    </div>
                                    {task.feedbackContent && (
                                        <div className="mb-3 p-3 bg-[var(--bg-secondary)] rounded-lg border border-[var(--border)]">
                                            <div className="text-xs text-[var(--text-secondary)] mb-1 font-medium">Feedback:</div>
                                            <div className="text-sm leading-relaxed">{task.feedbackContent}</div>
                                        </div>
                                    )}
                                    <div className="text-sm text-[var(--text-secondary)] pt-2 border-t border-[var(--border)]">
                                        Rated by {task.raterEmail} on {new Date(task.ratedAt).toLocaleDateString()}
                                    </div>
                                </div>
                            ))}

                            {filteredTasks.length === 0 && (
                                <div className="text-center py-8 text-[var(--text-secondary)]">
                                    No tasks match the selected filter
                                </div>
                            )}
                        </div>
                    </div>
                </>
            )}

            {/* Task History Modal */}
            {selectedTask && (
                <div
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        background: 'rgba(0, 0, 0, 0.8)',
                        backdropFilter: 'blur(4px)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 2000,
                        padding: '16px',
                    }}
                    onClick={() => setSelectedTask(null)}
                >
                    <div
                        className="glass-card"
                        style={{
                            maxWidth: '1000px',
                            width: '100%',
                            maxHeight: '90vh',
                            overflowY: 'auto',
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Modal Header */}
                        <div className="flex items-center justify-between mb-6 pb-4 border-b border-[var(--border)]">
                            <h2 className="text-2xl font-bold">Task History</h2>
                            <button onClick={() => setSelectedTask(null)} className="btn-secondary">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {historyLoading && (
                            <div className="text-center py-12">
                                <div className="animate-spin h-8 w-8 border-4 border-[var(--accent)] border-t-transparent rounded-full mx-auto mb-4" />
                                <p className="text-[var(--text-secondary)]">Loading task history...</p>
                            </div>
                        )}

                        {taskHistory && !historyLoading && (
                            <>
                                {/* Task Details */}
                                <div className="mb-6">
                                    <h3 className="font-semibold mb-3">Task Details</h3>
                                    <div className="bg-[var(--bg-secondary)] p-4 rounded-lg">
                                        <div className="mb-3">{taskHistory.task.content}</div>
                                        <div className="grid grid-cols-2 gap-4 text-sm text-[var(--text-secondary)]">
                                            <div>
                                                <span className="font-medium">Environment:</span> {taskHistory.task.environment || 'N/A'}
                                            </div>
                                            <div>
                                                <span className="font-medium">Created:</span> {new Date(taskHistory.task.createdAt).toLocaleDateString()}
                                            </div>
                                            <div>
                                                <span className="font-medium">Author:</span> {taskHistory.task.createdByName || taskHistory.task.createdByEmail || 'N/A'}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Related Tasks */}
                                {taskHistory.relatedTasks.length > 0 && (
                                    <div className="mb-6">
                                        <h3 className="font-semibold mb-3">Related Tasks from Same Worker</h3>
                                        <div className="space-y-2">
                                            {taskHistory.relatedTasks.map((relTask) => (
                                                <div key={relTask.id} className="bg-[var(--bg-secondary)] p-3 rounded-lg">
                                                    <div className="mb-2">{relTask.content}</div>
                                                    <div className="text-sm text-[var(--text-secondary)]">
                                                        {relTask.environment || 'Unknown'} • {new Date(relTask.createdAt).toLocaleDateString()}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* All Feedbacks */}
                                <div>
                                    <h3 className="font-semibold mb-3">All Feedbacks ({taskHistory.allFeedbacks.length})</h3>
                                    <div className="space-y-3">
                                        {taskHistory.allFeedbacks.map((feedback) => (
                                            <div key={feedback.feedbackId} className="bg-[var(--bg-secondary)] p-4 rounded-lg">
                                                <div className="mb-3">{feedback.feedbackContent}</div>
                                                <div className="grid grid-cols-2 gap-4 text-sm">
                                                    <div>
                                                        <span className="text-[var(--text-secondary)]">QA:</span>{' '}
                                                        {feedback.qaName || feedback.qaEmail || 'N/A'}
                                                    </div>
                                                    <div>
                                                        <span className="text-[var(--text-secondary)]">Created:</span>{' '}
                                                        {new Date(feedback.feedbackCreatedAt).toLocaleDateString()}
                                                    </div>
                                                    {feedback.ratingId && (
                                                        <>
                                                            <div>
                                                                <span className="text-[var(--text-secondary)]">Rating:</span>{' '}
                                                                <span className={feedback.isHelpful ? 'text-green-500' : 'text-red-500'}>
                                                                    {feedback.isHelpful ? 'Helpful' : 'Not Helpful'}
                                                                </span>
                                                                {feedback.isDispute && (
                                                                    <span className="ml-2 text-yellow-500">(Disputed)</span>
                                                                )}
                                                            </div>
                                                            <div>
                                                                <span className="text-[var(--text-secondary)]">Rater:</span> {feedback.raterEmail}
                                                            </div>
                                                        </>
                                                    )}
                                                    {!feedback.ratingId && (
                                                        <div className="col-span-2 text-[var(--text-secondary)]">
                                                            No rating available
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        ))}

                                        {taskHistory.allFeedbacks.length === 0 && (
                                            <div className="text-center py-8 text-[var(--text-secondary)]">
                                                No feedbacks found for this task
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}
