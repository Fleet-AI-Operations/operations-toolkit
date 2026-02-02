"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { Check } from "lucide-react";
import { useProjects } from "@/hooks/useProjects";

interface TopPromptRecord {
    id: string;
    content: string;
    category: "TOP_10" | "BOTTOM_10";
    source: string;
    metadata: Record<string, any> | null;
    isCategoryCorrect: boolean | null;
    hasBeenReviewed: boolean;
    reviewedBy: string | null;
    likertScores: {
        count: number;
        avgRealism: number | null;
        avgQuality: number | null;
    };
}

export default function TopPromptsReview() {
    const searchParams = useSearchParams();
    const {
        projects,
        selectedProjectId,
        setSelectedProjectId,
        loading: projectsLoading,
        error: projectsError
    } = useProjects({
        autoSelectFirst: true,
        initialProjectId: searchParams.get("projectId") || ""
    });

    const [allRecords, setAllRecords] = useState<TopPromptRecord[]>([]);
    const [environments, setEnvironments] = useState<string[]>([]);
    const [selectedEnv, setSelectedEnv] = useState<string>("all");
    const [verifiedOnly, setVerifiedOnly] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Filter records based on environment and verification status
    const filteredRecords = allRecords.filter((record) => {
        const envKey = record.metadata?.environment_name || record.metadata?.env_key || "unknown";
        const matchesEnv = selectedEnv === "all" || envKey === selectedEnv;

        const isVerified = record.hasBeenReviewed && record.isCategoryCorrect === true;
        const matchesVerification = !verifiedOnly || isVerified;

        return matchesEnv && matchesVerification;
    });

    useEffect(() => {
        if (selectedProjectId) {
            fetchRecords();
        }
    }, [selectedProjectId]);

    const fetchRecords = async () => {
        if (!selectedProjectId || selectedProjectId.trim() === "" || selectedProjectId === "undefined") {
            setError("No project selected");
            setLoading(false);
            return;
        }

        try {
            setLoading(true);
            setError(null);

            const response = await fetch(
                `/api/records/topbottom-review?projectId=${selectedProjectId}&category=TOP_10&includeReviewed=true`,
            );

            if (!response.ok) {
                throw new Error("Failed to fetch records");
            }

            const data = await response.json();
            setAllRecords(data.records);

            // Extract unique environments from metadata (prioritize environment_name)
            const envSet = new Set<string>();
            data.records.forEach((record: TopPromptRecord) => {
                const envKey = record.metadata?.environment_name || record.metadata?.env_key;
                if (envKey) {
                    envSet.add(envKey);
                }
            });

            setEnvironments(Array.from(envSet).sort());
        } catch (err) {
            setError(err instanceof Error ? err.message : "An error occurred");
            setAllRecords([]);
        } finally {
            setLoading(false);
        }
    };

    const getVerificationStatus = (record: TopPromptRecord) => {
        return record.hasBeenReviewed && record.isCategoryCorrect === true;
    };

    return (
        <div style={{ width: "100%", maxWidth: "1600px", margin: "0 auto" }}>
            <div style={{ marginBottom: "24px" }}>
                <h1 className="premium-gradient" style={{ fontSize: "2.5rem", marginBottom: "8px" }}>Top Prompts</h1>
                <p style={{ color: "rgba(255,255,255,0.6)" }}>Browse and filter top-performing prompts</p>
            </div>

            {loading ? (
                <div
                    style={{
                        textAlign: "center",
                        color: "#60a5fa",
                        padding: "60px 20px",
                    }}
                >
                    <p style={{ fontSize: "16px" }}>Loading records...</p>
                </div>
            ) : error ? (
                <div className="glass-card" style={{ textAlign: "center", padding: "60px 20px" }}>
                    <p style={{ color: "#f87171", fontSize: "16px", marginBottom: "16px" }}>Error: {error}</p>
                    <button
                        onClick={() => fetchRecords()}
                        className="btn-primary"
                        style={{
                            padding: "10px 24px",
                            fontSize: "14px",
                        }}
                    >
                        Retry
                    </button>
                </div>
            ) : (
                <>
                    <div
                        className="glass-card"
                        style={{
                            display: "flex",
                            gap: "20px",
                            marginBottom: "20px",
                            alignItems: "center",
                            justifyContent: "space-between",
                            flexWrap: "wrap",
                            padding: "14px 20px",
                        }}
                    >
                        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                                <label
                                    htmlFor="env-filter"
                                    style={{
                                        color: "rgba(255,255,255,0.7)",
                                        fontSize: "13px",
                                        fontWeight: "600",
                                    }}
                                >
                                    Environment:
                                </label>
                                <select
                                    id="env-filter"
                                    value={selectedEnv}
                                    onChange={(e) => setSelectedEnv(e.target.value)}
                                    style={{
                                        padding: "8px 12px",
                                        borderRadius: "6px",
                                        border: "1px solid rgba(255,255,255,0.1)",
                                        fontSize: "13px",
                                        background: "rgba(0, 0, 0, 0.4)",
                                        color: "rgba(255,255,255,0.9)",
                                        cursor: "pointer",
                                        fontWeight: "500",
                                        minWidth: "180px",
                                    }}
                                >
                                    <option value="all" style={{ background: "#1a1a1a", color: "white" }}>
                                        All Environments
                                    </option>
                                    {environments.map((env) => (
                                        <option key={env} value={env} style={{ background: "#1a1a1a", color: "white" }}>
                                            {env}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <label
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "6px",
                                    cursor: "pointer",
                                    padding: "8px 14px",
                                    borderRadius: "6px",
                                    backgroundColor: verifiedOnly ? "rgba(34, 197, 94, 0.12)" : "rgba(255,255,255,0.03)",
                                    border: `1px solid ${verifiedOnly ? "rgba(34, 197, 94, 0.4)" : "rgba(255,255,255,0.1)"}`,
                                    transition: "all 0.2s",
                                    userSelect: "none",
                                }}
                            >
                                <input
                                    type="checkbox"
                                    id="verified-only"
                                    checked={verifiedOnly}
                                    onChange={(e) => setVerifiedOnly(e.target.checked)}
                                    style={{
                                        width: "15px",
                                        height: "15px",
                                        cursor: "pointer",
                                        accentColor: "#22c55e",
                                        margin: 0,
                                    }}
                                />
                                <span
                                    style={{
                                        color: verifiedOnly ? "#22c55e" : "rgba(255,255,255,0.7)",
                                        fontSize: "13px",
                                        fontWeight: "600",
                                    }}
                                >
                                    Verified Only
                                </span>
                            </label>
                        </div>

                        <div style={{
                            color: "rgba(255, 255, 255, 0.6)",
                            fontSize: "13px",
                            fontWeight: "500",
                            marginLeft: "auto"
                        }}>
                            {filteredRecords.length} prompt{filteredRecords.length !== 1 ? 's' : ''}
                        </div>
                    </div>

                    {filteredRecords.length === 0 ? (
                        <div className="glass-card" style={{ textAlign: "center", padding: "80px 20px" }}>
                            <div style={{ fontSize: "48px", marginBottom: "16px", opacity: 0.3 }}>🔍</div>
                            <p style={{ fontSize: "18px", marginBottom: "8px", color: "rgba(255,255,255,0.8)" }}>
                                No prompts found
                            </p>
                            <p style={{ fontSize: "14px", color: "rgba(255,255,255,0.5)" }}>
                                Try adjusting your filters
                            </p>
                        </div>
                    ) : (
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(500px, 1fr))", gap: "16px" }}>
                            {filteredRecords.map((record, index) => {
                                const isVerified = getVerificationStatus(record);
                                const envKey = record.metadata?.environment_name || record.metadata?.env_key || "unknown";

                                return (
                                    <div
                                        key={record.id}
                                        className="glass-card prompt-card"
                                        style={{
                                            padding: "20px",
                                            position: "relative",
                                            transition: "all 0.2s",
                                            border: "1px solid rgba(255,255,255,0.05)",
                                        }}
                                    >
                                        <div
                                            style={{
                                                display: "flex",
                                                justifyContent: "space-between",
                                                alignItems: "center",
                                                marginBottom: "16px",
                                                gap: "12px",
                                            }}
                                        >
                                            <span
                                                style={{
                                                    padding: "5px 12px",
                                                    background: "linear-gradient(135deg, rgba(59, 130, 246, 0.2), rgba(37, 99, 235, 0.3))",
                                                    color: "#93c5fd",
                                                    borderRadius: "16px",
                                                    fontSize: "12px",
                                                    fontWeight: "600",
                                                    border: "1px solid rgba(59, 130, 246, 0.3)",
                                                }}
                                            >
                                                {envKey}
                                            </span>

                                            {record.likertScores.count > 0 && (
                                                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                                    <span
                                                        data-tooltip="Average Realism Score"
                                                        style={{
                                                            padding: "5px 10px",
                                                            background: "rgba(0, 112, 243, 0.15)",
                                                            borderRadius: "12px",
                                                            fontSize: "11px",
                                                            fontWeight: "600",
                                                            border: "1px solid rgba(0, 112, 243, 0.3)",
                                                            display: "flex",
                                                            alignItems: "center",
                                                            gap: "4px",
                                                            cursor: "pointer",
                                                            position: "relative",
                                                        }}
                                                    >
                                                        <span style={{ color: "rgba(255,255,255,0.5)" }}>R:</span>
                                                        <span style={{ color: "#0070f3" }}>{record.likertScores.avgRealism}/7</span>
                                                    </span>
                                                    <span
                                                        data-tooltip="Average Quality Score"
                                                        style={{
                                                            padding: "5px 10px",
                                                            background: "rgba(34, 197, 94, 0.15)",
                                                            borderRadius: "12px",
                                                            fontSize: "11px",
                                                            fontWeight: "600",
                                                            border: "1px solid rgba(34, 197, 94, 0.3)",
                                                            display: "flex",
                                                            alignItems: "center",
                                                            gap: "4px",
                                                            cursor: "pointer",
                                                            position: "relative",
                                                        }}
                                                    >
                                                        <span style={{ color: "rgba(255,255,255,0.5)" }}>Q:</span>
                                                        <span style={{ color: "#22c55e" }}>{record.likertScores.avgQuality}/7</span>
                                                    </span>
                                                </div>
                                            )}

                                            {isVerified && (
                                                <div
                                                    data-tooltip="Reviewed and confirmed as top 10% performer"
                                                    style={{
                                                        display: "flex",
                                                        alignItems: "center",
                                                        gap: "6px",
                                                        padding: "5px 12px",
                                                        background: "linear-gradient(135deg, rgba(34, 197, 94, 0.15), rgba(22, 163, 74, 0.25))",
                                                        borderRadius: "16px",
                                                        border: "1px solid rgba(34, 197, 94, 0.3)",
                                                        cursor: "help",
                                                        position: "relative",
                                                    }}
                                                    className="verified-badge"
                                                >
                                                    <Check size={14} color="#22c55e" strokeWidth={3} />
                                                    <span
                                                        style={{
                                                            color: "#22c55e",
                                                            fontSize: "11px",
                                                            fontWeight: "700",
                                                            textTransform: "uppercase",
                                                            letterSpacing: "0.5px",
                                                        }}
                                                    >
                                                        Verified
                                                    </span>
                                                </div>
                                            )}
                                        </div>

                                        <div
                                            style={{
                                                backgroundColor: "rgba(0,0,0,0.3)",
                                                padding: "16px",
                                                borderRadius: "8px",
                                                border: "1px solid rgba(255,255,255,0.05)",
                                                minHeight: "80px",
                                            }}
                                        >
                                            <p
                                                style={{
                                                    color: "rgba(255,255,255,0.9)",
                                                    whiteSpace: "pre-wrap",
                                                    fontSize: "14px",
                                                    lineHeight: "1.6",
                                                    margin: 0,
                                                }}
                                            >
                                                {record.content}
                                            </p>
                                        </div>

                                        {record.reviewedBy && (
                                            <div
                                                style={{
                                                    marginTop: "12px",
                                                    paddingTop: "12px",
                                                    borderTop: "1px solid rgba(255,255,255,0.05)",
                                                    color: "rgba(255,255,255,0.4)",
                                                    fontSize: "11px",
                                                    fontWeight: "500",
                                                }}
                                            >
                                                Reviewed by: <span style={{ color: "rgba(255,255,255,0.6)" }}>{record.reviewedBy}</span>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
