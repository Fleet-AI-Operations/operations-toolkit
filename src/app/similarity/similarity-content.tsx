"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useSearchParams } from "next/navigation";
import RedZoneModal from "./RedZoneModal";
import { useProjects } from "@/hooks/useProjects";

interface Prompt {
  id: string;
  content: string;
  category: string | null;
  createdById: string | null;
  createdByEmail: string | null;
  createdByName: string | null;
  createdAt: string;
}

interface SimilarPrompt {
  id: string;
  content: string;
  category: string | null;
  similarity: number;
  createdAt: string;
}

interface User {
  id: string;
  name: string;
}

export default function PromptSimilarityPage() {
  const searchParams = useSearchParams();
  const { projects, selectedProjectId, setSelectedProjectId } = useProjects({
    initialProjectId: searchParams?.get("projectId") || undefined,
  });

  const [allPrompts, setAllPrompts] = useState<Prompt[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [selectedPrompt, setSelectedPrompt] = useState<Prompt | null>(null);
  const [similarPrompts, setSimilarPrompts] = useState<SimilarPrompt[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showRedZoneModal, setShowRedZoneModal] = useState(false);
  const [redZoneThreshold, setRedZoneThreshold] = useState(70);

  useEffect(() => {
    if (!selectedProjectId) return;

    const fetchPrompts = async () => {
      try {
        const url = new URL("/api/analysis/prompts", window.location.origin);
        url.searchParams.set("projectId", selectedProjectId);

        const response = await fetch(url.toString());
        const data = await response.json();

        if (data.error) {
          setError(data.error);
          return;
        }

        setAllPrompts(data.prompts);
        setUsers(data.users);
        setError(null);
      } catch (err: any) {
        setError(err.message);
      }
    };

    fetchPrompts();
  }, [selectedProjectId]);

  const filteredPrompts = useMemo(() => {
    if (selectedUserId) {
      return allPrompts.filter((p) => p.createdById === selectedUserId);
    }
    return allPrompts;
  }, [selectedUserId, allPrompts]);

  useEffect(() => {
    if (!selectedPrompt || !selectedProjectId) {
      setSimilarPrompts([]);
      return;
    }

    const fetchSimilarity = async () => {
      setLoading(true);
      setSimilarPrompts([]);
      setError(null);

      try {
        const response = await fetch(
          `/api/analysis/prompt-similarity?projectId=${selectedProjectId}&recordId=${selectedPrompt.id}`,
        );
        const data = await response.json();

        if (data.error) {
          setError(data.error);
          return;
        }

        setSimilarPrompts(data.similarPrompts);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchSimilarity();
  }, [selectedPrompt, selectedProjectId]);

  // Scroll ref for the left prompts list so we can reset scroll when user filter changes
  const promptsListRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // When the selected user filter changes, reset the left prompts scroll to top
    if (promptsListRef.current) {
      promptsListRef.current.scrollTo({ top: 0, behavior: 'auto' });
    }
    // Also reset selected prompt and similar prompts when user filter changes
    setSelectedPrompt(null);
    setSimilarPrompts([]);
  }, [selectedUserId]);

  const getSimilarityColor = (similarity: number): string => {
    if (similarity >= 70) {
      return "#ef4444";
    }
    if (similarity >= 40) {
      return "#eab308";
    }
    return "#22c55e";
  };

  if (!selectedProjectId && projects.length === 0) {
    return (
      <div style={{ padding: "40px", textAlign: "center" }}>
        <p>Please select a project to view prompt similarity.</p>
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        maxWidth: "1600px",
        margin: "0 auto",
        height: 'calc(100vh - 140px)',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          padding: "12px 24px",
          borderBottom: "1px solid var(--border)",
          background: "var(--glass)",
          flexShrink: 0,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div>
          <h1
            className="premium-gradient"
            style={{ margin: 0, fontSize: "1.5rem", marginBottom: "8px" }}
          >
            Prompt Similarity Analysis
          </h1>
          <p style={{ margin: 0, color: 'rgba(255,255,255,0.8)' }}>
            Select a prompt to see similar prompts from the same user
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <label
              style={{
                fontSize: "13px",
                color: "rgba(255,255,255,0.6)",
                whiteSpace: "nowrap",
              }}
            >
              Threshold:
            </label>
            <input
              type="range"
              min="50"
              max="95"
              value={redZoneThreshold}
              onChange={(e) => setRedZoneThreshold(Number(e.target.value))}
              style={{
                width: "80px",
                accentColor: "#ef4444",
              }}
            />
            <span
              style={{
                fontSize: "13px",
                fontWeight: 600,
                color: "#ef4444",
                minWidth: "36px",
              }}
            >
              {redZoneThreshold}%
            </span>
          </div>
          <button
            onClick={() => setShowRedZoneModal(true)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "10px 16px",
              borderRadius: "8px",
              border: "1px solid rgba(239, 68, 68, 0.3)",
              background: "rgba(239, 68, 68, 0.15)",
              color: "#ef4444",
              fontSize: "13px",
              fontWeight: 600,
              cursor: "pointer",
              transition: "all 0.2s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(239, 68, 68, 0.25)";
              e.currentTarget.style.borderColor = "rgba(239, 68, 68, 0.5)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "rgba(239, 68, 68, 0.15)";
              e.currentTarget.style.borderColor = "rgba(239, 68, 68, 0.3)";
            }}
          >
            <span style={{ fontSize: "16px" }}>🚨</span>
            Red Zone Review
          </button>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          flex: 1,
          height: '100%',
          overflow: "hidden",
          gap: "16px",
          padding: 0,
        }}
      >
        <div
          style={{
            width: "40%",
            display: "flex",
            flexDirection: "column",
            background: "var(--glass)",
            borderRadius: "12px",
            border: "1px solid var(--border)",
            overflow: "hidden",
            height: '100%'
          }}
        >
          <div
            style={{ padding: "16px", borderBottom: "1px solid var(--border)" }}
          >

            <label
              style={{
                display: "block",
                marginBottom: "8px",
                fontWeight: 600,
                fontSize: "14px",
                color: "rgba(255,255,255,0.8)",
              }}
            >
              Filter by User:
            </label>
            <select
              value={selectedUserId}
              onChange={(e) => {
                setSelectedUserId(e.target.value);
                setSelectedPrompt(null);
                setSimilarPrompts([]);
              }}
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: "8px",
                border: "1px solid var(--border)",
                fontSize: "14px",
                background: "rgba(0, 0, 0, 0.3)",
                color: "rgba(255,255,255,0.95)",
                cursor: "pointer",
                fontWeight: 500,
              }}
            >
              <option
                value=""
                style={{ background: "#1a1a1a", color: "white" }}
              >
                All Users ({users.length})
              </option>
              {users.map((user) => (
                <option
                  key={user.id}
                  value={user.id}
                  style={{ background: "#1a1a1a", color: "white" }}
                >
                  {user.name}
                </option>
              ))}
            </select>
          </div>

          <div
            style={{
              padding: "12px 16px",
              borderBottom: "1px solid var(--border)",
              fontSize: "13px",
              color: "rgba(255,255,255,0.6)",
              fontWeight: 500,
            }}
          >
            {filteredPrompts.length} prompt
            {filteredPrompts.length !== 1 ? "s" : ""}
          </div>

          <div ref={promptsListRef} style={{ flex: 1, overflowY: "auto", padding: "12px" }}>
            {filteredPrompts.length === 0 ? (
              <div
                style={{
                  padding: "24px",
                  textAlign: "center",
                  color: "rgba(255,255,255,0.4)",
                }}
              >
                No prompts found
              </div>
            ) : (
              filteredPrompts.map((prompt) => (
                <div
                  key={prompt.id}
                  onClick={() => setSelectedPrompt(prompt)}
                  style={{
                    padding: "14px",
                    marginBottom: "8px",
                    borderRadius: "8px",
                    backgroundColor:
                      selectedPrompt?.id === prompt.id
                        ? "var(--accent)"
                        : "rgba(255,255,255,0.05)",
                    color:
                      selectedPrompt?.id === prompt.id
                        ? "#000"
                        : "rgba(255,255,255,0.9)",
                    cursor: "pointer",
                    border:
                      selectedPrompt?.id === prompt.id
                        ? `1px solid var(--accent)`
                        : "1px solid var(--border)",
                    transition: "all 0.2s",
                  }}
                  onMouseEnter={(e) => {
                    if (selectedPrompt?.id !== prompt.id) {
                      e.currentTarget.style.backgroundColor =
                        "rgba(255,255,255,0.1)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (selectedPrompt?.id !== prompt.id) {
                      e.currentTarget.style.backgroundColor =
                        "rgba(255,255,255,0.05)";
                    }
                  }}
                >
                  <div
                    style={{
                      fontSize: "14px",
                      fontWeight: 500,
                      marginBottom: "6px",
                      lineHeight: "1.4",
                      maxHeight: "60px",
                      overflow: "hidden",
                    }}
                  >
                    {prompt.content}
                  </div>
                  <div style={{ fontSize: "12px", opacity: 0.6 }}>
                    {prompt.createdByName || prompt.createdByEmail || "Unknown"}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div
          style={{
            width: "60%",
            display: "flex",
            flexDirection: "column",
            background: "var(--glass)",
            borderRadius: "12px",
            border: "1px solid var(--border)",
            overflow: "hidden",
            height: '100%'
          }}
        >
          {!selectedPrompt ? (
            <div
              style={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "rgba(255,255,255,0.4)",
              }}
            >
              <p>← Select a prompt from the left to view similar prompts</p>
            </div>
          ) : (
            <>
              <div
                style={{
                  padding: "16px",
                  borderBottom: "1px solid var(--border)",
                  height: "200px",
                  display: "flex",
                  flexDirection: "column",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "baseline",
                    justifyContent: "space-between",
                    marginBottom: "8px",
                  }}
                >
                  <h3
                    style={{
                      margin: 0,
                      fontSize: "16px",
                      color: "rgba(255,255,255,0.9)",
                    }}
                  >
                    Selected Prompt:
                  </h3>
                  <div
                    style={{ fontSize: "12px", color: "rgba(255,255,255,0.5)" }}
                  >
                    By:{" "}
                    {selectedPrompt.createdByName ||
                      selectedPrompt.createdByEmail ||
                      "Unknown"}
                  </div>
                </div>
                <div
                  style={{
                    padding: "12px",
                    backgroundColor: "rgba(255,255,255,0.05)",
                    borderRadius: "8px",
                    border: "1px solid var(--border)",
                    fontSize: "14px",
                    lineHeight: "1.6",
                    color: "rgba(255,255,255,0.9)",
                    overflowY: "auto",
                    flex: 1,
                  }}
                >
                  {selectedPrompt.content}
                </div>
              </div>

              <div
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  overflow: "hidden",
                }}
              >
                <div style={{ padding: "16px 16px 0 16px", flexShrink: 0 }}>
                  <h3
                    style={{
                      margin: "0",
                      fontSize: "16px",
                      color: "rgba(255,255,255,0.9)",
                    }}
                  >
                    Similar Prompts ({similarPrompts.length})
                  </h3>
                </div>
                <div
                  style={{ flex: 1, overflowY: "auto", padding: "12px 16px" }}
                >
                  {loading ? (
                    <div
                      style={{
                        textAlign: "center",
                        padding: "40px",
                        color: "rgba(255,255,255,0.4)",
                      }}
                    >
                      Calculating similarity...
                    </div>
                  ) : error ? (
                    <div
                      style={{
                        padding: "16px",
                        backgroundColor: "rgba(239, 68, 68, 0.1)",
                        borderRadius: "8px",
                        color: "#fca5a5",
                        border: "1px solid rgba(239, 68, 68, 0.2)",
                      }}
                    >
                      {error}
                    </div>
                  ) : similarPrompts.length === 0 ? (
                    <div
                      style={{
                        textAlign: "center",
                        padding: "40px",
                        color: "rgba(255,255,255,0.4)",
                      }}
                    >
                      No other prompts found from this user
                    </div>
                  ) : (
                    <>
                      {similarPrompts.map((prompt) => (
                        <details
                          key={prompt.id}
                          style={{
                            marginBottom: "12px",
                            borderRadius: "8px",
                            border: "1px solid var(--border)",
                            overflow: "hidden",
                            background: "rgba(255,255,255,0.02)",
                          }}
                        >
                          <summary
                            style={{
                              padding: "12px",
                              cursor: "pointer",
                              backgroundColor: "rgba(255,255,255,0.05)",
                              borderLeft: `4px solid ${getSimilarityColor(prompt.similarity)}`,
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              transition: "all 0.2s",
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor =
                                "rgba(255,255,255,0.08)";
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor =
                                "rgba(255,255,255,0.05)";
                            }}
                          >
                            <span
                              style={{
                                flex: 1,
                                fontSize: "14px",
                                lineHeight: "1.4",
                                marginRight: "12px",
                                color: "rgba(255,255,255,0.9)",
                              }}
                            >
                              {prompt.content.substring(0, 80)}
                              {prompt.content.length > 80 && "..."}
                            </span>
                            <span
                              style={{
                                fontWeight: 700,
                                fontSize: "16px",
                                color: getSimilarityColor(prompt.similarity),
                                minWidth: "50px",
                                textAlign: "right",
                              }}
                            >
                              {prompt.similarity}%
                            </span>
                          </summary>
                          <div
                            style={{
                              padding: "16px",
                              backgroundColor: "rgba(255,255,255,0.02)",
                              fontSize: "14px",
                              lineHeight: "1.6",
                              borderTop: "1px solid var(--border)",
                              color: "rgba(255,255,255,0.85)",
                            }}
                          >
                            {prompt.content}
                          </div>
                        </details>
                      ))}
                    </>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <RedZoneModal
        isOpen={showRedZoneModal}
        onClose={() => setShowRedZoneModal(false)}
        projectId={selectedProjectId}
        threshold={redZoneThreshold}
      />
    </div>
  );
}
