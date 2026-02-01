"use client";

import { useEffect, useState, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";

interface LikertRecord {
    id: string;
    content: string;
    category: "TOP_10" | "BOTTOM_10" | null;
    source: string;
    metadata: Record<string, any> | null;
    createdAt: string;
    isCategoryCorrect: boolean | null;
}

export default function LikertScoring() {
    const searchParams = useSearchParams();
    const projectId = searchParams.get("projectId");
    
    // Memoize Supabase client to avoid recreating on every render
    const supabase = useMemo(() => createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    ), []);
    const [userId, setUserId] = useState<string | null>(null);
    const [authLoading, setAuthLoading] = useState(true);
    const [authError, setAuthError] = useState<string | null>(null);

    const [records, setRecords] = useState<LikertRecord[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [realismScore, setRealismScore] = useState<number | null>(null);
    const [qualityScore, setQualityScore] = useState<number | null>(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [evaluatingLLM, setEvaluatingLLM] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [llmAlreadyEvaluated, setLlmAlreadyEvaluated] = useState(false);
    const [llmEvaluatedThisSession, setLlmEvaluatedThisSession] = useState(false);
    const [userSubmittedRecordIds, setUserSubmittedRecordIds] = useState<Set<string>>(new Set());

    // Fetch current user from Supabase auth
    useEffect(() => {
        const getUser = async () => {
            try {
                const { data: { user }, error } = await supabase.auth.getUser();
                if (error) throw error;
                if (user) {
                    setUserId(user.id);
                } else {
                    setAuthError("Not authenticated");
                }
            } catch (err) {
                setAuthError(err instanceof Error ? err.message : "Failed to get user");
            } finally {
                setAuthLoading(false);
            }
        };
        getUser();
    }, [supabase.auth]);

    useEffect(() => {
        if (userId && projectId) {
            fetchRecords();
        }
    }, [projectId, userId]);

    // Check if current record has been evaluated by LLM and submitted by user
    useEffect(() => {
        if (records.length > 0 && currentIndex < records.length) {
            checkLLMEvaluationStatus();
            checkUserSubmissionStatus();
        }
    }, [currentIndex, records]);

    const fetchRecords = async () => {
        if (!projectId || projectId.trim() === "" || projectId === "undefined") {
            setError("No project selected");
            setLoading(false);
            return;
        }

        try {
            setLoading(true);
            setError(null);

            const response = await fetch(`/api/records/likert?projectId=${projectId}&userId=${userId}`);

            if (!response.ok) {
                throw new Error("Failed to fetch records");
            }

            const data = await response.json();
            setRecords(data.records);
            setCurrentIndex(0);
            setLlmAlreadyEvaluated(false);
        } catch (err) {
            setError(err instanceof Error ? err.message : "An error occurred");
            setRecords([]);
        } finally {
            setLoading(false);
        }
    };

    const checkLLMEvaluationStatus = async () => {
        try {
            const currentRecord = records[currentIndex];
            if (!currentRecord) return;

            const response = await fetch(
                `/api/records/likert-llm/history?recordId=${currentRecord.id}`
            );

            if (!response.ok) {
                console.error("Failed to check LLM evaluation history");
                setLlmAlreadyEvaluated(false);
                return;
            }

            const data = await response.json();
            // Accept ANY model evaluation, not just specific one
            const hasBeenEvaluated = data.evaluatedModels && data.evaluatedModels.length > 0;
            setLlmAlreadyEvaluated(hasBeenEvaluated);
        } catch (err) {
            console.error("Error checking LLM evaluation status:", err);
            setLlmAlreadyEvaluated(false);
        }
    };

    const checkUserSubmissionStatus = async () => {
        try {
            const currentRecord = records[currentIndex];
            if (!currentRecord) return;

            const response = await fetch(
                `/api/records/likert/check-submission?recordId=${currentRecord.id}&userId=${userId}`
            );

            if (!response.ok) {
                setUserSubmittedRecordIds(prev => {
                    const newSet = new Set(prev);
                    newSet.delete(currentRecord.id);
                    return newSet;
                });
                return;
            }

            const data = await response.json();
            // If user has a score for this record, mark it as submitted
            if (data.userScore) {
                setUserSubmittedRecordIds(prev => new Set([...prev, currentRecord.id]));
            } else {
                setUserSubmittedRecordIds(prev => {
                    const newSet = new Set(prev);
                    newSet.delete(currentRecord.id);
                    return newSet;
                });
            }
        } catch (err) {
            console.error("Error checking submission status:", err);
        }
    };

    const handleSubmit = async () => {
        if (realismScore === null || qualityScore === null) {
            alert("Please select both Realism and Quality scores");
            return;
        }

        const currentRecord = records[currentIndex];

        try {
            setSubmitting(true);
            setError(null);

            const response = await fetch("/api/records/likert", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    recordId: currentRecord.id,
                    userId,
                    realismScore,
                    qualityScore,
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || "Failed to submit score");
            }

            // Mark this record as submitted
            setUserSubmittedRecordIds(prev => new Set([...prev, currentRecord.id]));
            setRealismScore(null);
            setQualityScore(null);
            setLlmEvaluatedThisSession(false);

            let newRecords = records;

            // Only remove from list if LLM was evaluated (either this session or before)
            if (isLLMEvaluated) {
                newRecords = records.filter((r) => r.id !== currentRecord.id);
                setRecords(newRecords);
            }

            // Move to next record in list
            if (currentIndex < newRecords.length) {
                // If we removed the item, currentIndex now points to next item
                // If we kept the item, we need to move forward
                if (isLLMEvaluated) {
                    setCurrentIndex(Math.max(0, currentIndex));
                } else {
                    setCurrentIndex(currentIndex + 1);
                }
            } else if (newRecords.length > 0) {
                // Go to last record if we're at the end
                setCurrentIndex(newRecords.length - 1);
            } else {
                // No more records - refresh to get new ones
                fetchRecords();
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : "An error occurred");
        } finally {
            setSubmitting(false);
        }
    };
    const currentRecord = records[currentIndex];
    const isCurrentRecordSubmitted = currentRecord && userSubmittedRecordIds.has(currentRecord.id);
    const isLLMEvaluated = llmEvaluatedThisSession || llmAlreadyEvaluated;

    const handlePrevious = () => {
        if (currentIndex > 0) {
            setCurrentIndex(currentIndex - 1);
            setRealismScore(null);
            setQualityScore(null);
            setLlmAlreadyEvaluated(false);
            setLlmEvaluatedThisSession(false);
            setEvaluatingLLM(false);
            setError(null);
        }
    };

    const handleNext = () => {
        if (currentIndex < records.length - 1) {
            setCurrentIndex(currentIndex + 1);
            setRealismScore(null);
            setQualityScore(null);
            setLlmAlreadyEvaluated(false);
            setLlmEvaluatedThisSession(false);
            setEvaluatingLLM(false);
            setError(null);
        }
    };

    const handleEvaluateWithLLM = async () => {
        const currentRecord = records[currentIndex];

        try {
            setEvaluatingLLM(true);
            setError(null);

            // Support multiple LLMs: Add additional model names to this array
            // Example: ["meta-llama-3.1-8b-instruct", "mistral-7b", "neural-chat"]
            const modelsToEvaluate = ["meta-llama-3.1-8b-instruct"];

            const response = await fetch("/api/records/likert-llm", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    recordId: currentRecord.id,
                    content: currentRecord.content,
                    models: modelsToEvaluate,
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || "Failed to evaluate with LLM");
            }

            const data = await response.json();
            const results = data.results;
            const hasErrors = results.some((r: any) => r.error);
            const successCount = results.filter((r: any) => !r.error).length;

            if (hasErrors && successCount === 0) {
                throw new Error(results.map((r: any) => r.error).join(", "));
            }

            // Update evaluation status and mark this session as evaluated
            await checkLLMEvaluationStatus();
            setLlmEvaluatedThisSession(true);

            // If this record was already submitted without LLM, remove it from queue now
            if (userSubmittedRecordIds.has(currentRecord.id)) {
                const newRecords = records.filter((r) => r.id !== currentRecord.id);
                setRecords(newRecords);

                // Move to next or previous record
                if (currentIndex < newRecords.length) {
                    setCurrentIndex(currentIndex);
                } else if (newRecords.length > 0) {
                    setCurrentIndex(newRecords.length - 1);
                } else {
                    fetchRecords();
                }
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : "An error occurred");
        } finally {
            setEvaluatingLLM(false);
        }
    };

    return (
        <div style={{ maxWidth: "900px", margin: "0 auto", padding: "0 20px 30px 20px" }}>
            <div style={{ marginBottom: "16px" }}>
                <h1
                    className="premium-gradient"
                    style={{
                        fontSize: "1.5rem",
                        fontWeight: "bold",
                        marginBottom: "2px",
                    }}
                >
                    Likert Scoring
                </h1>
                <p style={{ color: "rgba(255,255,255,0.5)", fontSize: "12px", margin: 0 }}>
                    Rate prompts on Realism and Quality (1-7 scale)
                </p>
            </div>

            {authLoading ? (
                <div style={{ textAlign: "center", color: "#60a5fa", padding: "60px 20px" }}>
                    <p style={{ fontSize: "16px" }}>Authenticating...</p>
                </div>
            ) : authError ? (
                <div className="glass-card" style={{ textAlign: "center", padding: "60px 20px" }}>
                    <p style={{ color: "#f87171", fontSize: "16px", marginBottom: "16px" }}>
                        Authentication Error: {authError}
                    </p>
                    <button
                        onClick={() => window.location.href = "/login"}
                        className="btn-primary"
                        style={{ padding: "10px 24px", fontSize: "14px" }}
                    >
                        Go to Login
                    </button>
                </div>
            ) : loading ? (
                <div style={{ textAlign: "center", color: "#60a5fa", padding: "60px 20px" }}>
                    <p style={{ fontSize: "16px" }}>Loading prompts...</p>
                </div>
            ) : error ? (
                <div className="glass-card" style={{ textAlign: "center", padding: "60px 20px" }}>
                    <p style={{ color: "#f87171", fontSize: "16px", marginBottom: "16px" }}>
                        Error: {error}
                    </p>
                    <button
                        onClick={() => fetchRecords()}
                        className="btn-primary"
                        style={{ padding: "10px 24px", fontSize: "14px" }}
                    >
                        Retry
                    </button>
                </div>
            ) : records.length === 0 ? (
                <div className="glass-card" style={{ textAlign: "center", padding: "80px 20px" }}>
                    <div style={{ fontSize: "48px", marginBottom: "16px", opacity: 0.3 }}>✅</div>
                    <p style={{ fontSize: "18px", marginBottom: "8px", color: "rgba(255,255,255,0.8)" }}>
                        All prompts rated!
                    </p>
                    <p style={{ fontSize: "14px", color: "rgba(255,255,255,0.5)" }}>
                        You've scored all available prompts for this project
                    </p>
                </div>
            ) : (
                <>
                    <div className="glass-card" style={{ padding: "24px", marginBottom: "16px" }}>
                        <div style={{ marginBottom: "16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <button
                                onClick={handlePrevious}
                                disabled={currentIndex === 0}
                                style={{
                                    background: "transparent",
                                    border: "none",
                                    color: currentIndex === 0 ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.7)",
                                    fontSize: "24px",
                                    cursor: currentIndex === 0 ? "not-allowed" : "pointer",
                                    padding: "12px 16px",
                                    transition: "all 0.2s",
                                }}
                            >
                                ‹
                            </button>

                            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px" }}>
                                <span style={{ color: "rgba(255,255,255,0.7)", fontSize: "13px", fontWeight: "600" }}>
                                    {currentIndex + 1}/{records.length}
                                </span>

                                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "4px" }}>
                                    <span
                                        style={{
                                            padding: "4px 10px",
                                            background:
                                                currentRecord.category === "TOP_10"
                                                    ? "linear-gradient(135deg, rgba(34, 197, 94, 0.2), rgba(22, 163, 74, 0.3))"
                                                    : currentRecord.category === "BOTTOM_10"
                                                    ? "linear-gradient(135deg, rgba(239, 68, 68, 0.2), rgba(220, 38, 38, 0.3))"
                                                    : "transparent",
                                            color: currentRecord.category === "TOP_10" ? "#22c55e" : currentRecord.category === "BOTTOM_10" ? "#ef4444" : "transparent",
                                            borderRadius: "20px",
                                            fontSize: "10px",
                                            fontWeight: "700",
                                            textTransform: "uppercase",
                                            letterSpacing: "0.5px",
                                            border: currentRecord.category ? `1px solid ${currentRecord.category === "TOP_10" ? "rgba(34, 197, 94, 0.4)" : "rgba(239, 68, 68, 0.4)"}` : "1px solid transparent",
                                            whiteSpace: "nowrap",
                                            visibility: currentRecord.category ? "visible" : "hidden",
                                            display: "inline-flex",
                                            alignItems: "center",
                                            gap: "4px",
                                        }}
                                    >
                                        {currentRecord.category === "TOP_10" ? "Top 10%" : currentRecord.category === "BOTTOM_10" ? "Bottom 10%" : "Hidden"}
                                        {currentRecord.category === "TOP_10" && currentRecord.isCategoryCorrect === true && (
                                            <span style={{ fontSize: "10px" }}>✓</span>
                                        )}
                                    </span>
                                    <span style={{ color: "rgba(255,255,255,0.5)", fontSize: "10px", fontWeight: "400", minHeight: "14px" }}>
                                        {currentRecord.metadata?.environment_name || currentRecord.metadata?.env_key || ""}
                                    </span>
                                </div>
                            </div>

                            <button
                                onClick={handleNext}
                                disabled={currentIndex === records.length - 1}
                                style={{
                                    background: "transparent",
                                    border: "none",
                                    color: currentIndex === records.length - 1 ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.7)",
                                    fontSize: "24px",
                                    cursor: currentIndex === records.length - 1 ? "not-allowed" : "pointer",
                                    padding: "12px 16px",
                                    transition: "all 0.2s",
                                }}
                            >
                                ›
                            </button>
                        </div>

                        <div
                            style={{
                                backgroundColor: "rgba(0,0,0,0.3)",
                                padding: "16px",
                                borderRadius: "12px",
                                border: "1px solid rgba(255,255,255,0.05)",
                                marginBottom: "16px",
                                height: "190px",
                                overflowY: "auto",
                            }}
                        >
                            <p
                                style={{
                                    color: "rgba(255,255,255,0.9)",
                                    whiteSpace: "pre-wrap",
                                    fontSize: "14px",
                                    lineHeight: "1.5",
                                    margin: 0,
                                }}
                            >
                                {currentRecord.content}
                            </p>
                        </div>

                        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                            <div>
                                <label
                                    style={{
                                        display: "block",
                                        color: "rgba(255,255,255,0.8)",
                                        fontSize: "14px",
                                        fontWeight: "600",
                                        marginBottom: "10px",
                                    }}
                                >
                                    Realism (1 = Not Realistic, 7 = Very Realistic)
                                </label>
                                <div style={{ display: "flex", gap: "8px", justifyContent: "center" }}>
                                    {[1, 2, 3, 4, 5, 6, 7].map((score) => (
                                        <button
                                            key={`realism-${score}`}
                                            onClick={() => setRealismScore(score)}
                                            style={{
                                                width: "32px",
                                                height: "32px",
                                                borderRadius: "10px",
                                                border: realismScore === score
                                                    ? "2px solid #0070f3"
                                                    : "1px solid rgba(255,255,255,0.1)",
                                                background: realismScore === score
                                                    ? "rgba(0, 112, 243, 0.2)"
                                                    : "rgba(255,255,255,0.03)",
                                                color: realismScore === score
                                                    ? "#0070f3"
                                                    : "rgba(255,255,255,0.7)",
                                                fontSize: "13px",
                                                fontWeight: "700",
                                                cursor: "pointer",
                                                transition: "all 0.2s",
                                            }}
                                        >
                                            {score}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label
                                    style={{
                                        display: "block",
                                        color: "rgba(255,255,255,0.8)",
                                        fontSize: "14px",
                                        fontWeight: "600",
                                        marginBottom: "10px",
                                    }}
                                >
                                    Quality (1 = Poor Quality, 7 = Excellent Quality)
                                </label>
                                <div style={{ display: "flex", gap: "8px", justifyContent: "center" }}>
                                    {[1, 2, 3, 4, 5, 6, 7].map((score) => (
                                        <button
                                            key={`quality-${score}`}
                                            onClick={() => setQualityScore(score)}
                                            style={{
                                                width: "32px",
                                                height: "32px",
                                                borderRadius: "10px",
                                                border: qualityScore === score
                                                    ? "2px solid #22c55e"
                                                    : "1px solid rgba(255,255,255,0.1)",
                                                background: qualityScore === score
                                                    ? "rgba(34, 197, 94, 0.2)"
                                                    : "rgba(255,255,255,0.03)",
                                                color: qualityScore === score
                                                    ? "#22c55e"
                                                    : "rgba(255,255,255,0.7)",
                                                fontSize: "13px",
                                                fontWeight: "700",
                                                cursor: "pointer",
                                                transition: "all 0.2s",
                                            }}
                                        >
                                            {score}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div style={{ marginTop: "20px", textAlign: "center", display: "flex", gap: "10px", justifyContent: "center", flexWrap: "wrap" }}>
                            <button
                                onClick={handleSubmit}
                                disabled={submitting || isCurrentRecordSubmitted || realismScore === null || qualityScore === null}
                                className="btn-primary"
                                style={{
                                    padding: "12px 36px",
                                    fontSize: "14px",
                                    fontWeight: "600",
                                    opacity: submitting || isCurrentRecordSubmitted || realismScore === null || qualityScore === null ? 0.5 : 1,
                                    cursor:
                                        submitting || isCurrentRecordSubmitted || realismScore === null || qualityScore === null
                                            ? "not-allowed"
                                            : "pointer",
                                }}
                            >
                                {isCurrentRecordSubmitted ? "✓ Submitted" : submitting ? "Submitting..." : "Submit & Next"}
                            </button>

                            <button
                                onClick={handleEvaluateWithLLM}
                                disabled={evaluatingLLM || llmAlreadyEvaluated || llmEvaluatedThisSession}
                                data-tooltip={llmAlreadyEvaluated || llmEvaluatedThisSession ? "LLM Check already run" : ""}
                                style={{
                                    padding: "12px 36px",
                                    fontSize: "14px",
                                    fontWeight: "600",
                                    background: "linear-gradient(135deg, rgba(0, 255, 136, 0.15), rgba(16, 185, 129, 0.2))",
                                    border: "1px solid rgba(0, 255, 136, 0.3)",
                                    color: "#00ff88",
                                    borderRadius: "8px",
                                    cursor: evaluatingLLM || llmAlreadyEvaluated || llmEvaluatedThisSession ? "not-allowed" : "pointer",
                                    opacity: evaluatingLLM || llmAlreadyEvaluated || llmEvaluatedThisSession ? 0.5 : 1,
                                    transition: "all 0.2s",
                                    position: "relative",
                                }}
                            >
                                {evaluatingLLM ? "Evaluating..." : "Run Against LLM"}
                            </button>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
