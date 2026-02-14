"use client";

import { useState, useEffect, useMemo, memo, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { Inbox, Check, X, ChevronDown, ChevronRight } from "lucide-react";
import { useProjects } from "@/hooks/useProjects";

interface FeedbackStats {
  userId: string;
  userEmail: string;
  userName: string | null;
  submittedCount: number;
  acceptedCount: number;
  deniedCount: number;
}

interface FeedbackDetails {
  isPositive: number;
  feedbackContent: string | null;
  rejectionReason: string | null;
  feedbackId: string | null;
  promptQualityRating: string | null;
  createdAt: string;
}

interface FeedbackItem {
  id: string;
  content: string;
  createdAt: string;
  taskKey: string | null;
  feedback: FeedbackDetails[];
}

// Memoized candidate list item to prevent re-renders when filter changes
const CandidateListItem = memo(
  ({
    user,
    isSelected,
    onSelect,
  }: {
    user: FeedbackStats;
    isSelected: boolean;
    onSelect: () => void;
  }) => (
    <button
      onClick={onSelect}
      style={{
        all: "unset",
        cursor: "pointer",
        padding: "14px 16px",
        paddingLeft: isSelected ? "13px" : "16px",
        borderBottom: "1px solid rgba(255, 255, 255, 0.05)",
        display: "flex",
        alignItems: "center",
        gap: "12px",
        transition: "background-color 0.2s ease",
        background: isSelected ? "rgba(255, 255, 255, 0.15)" : undefined,
        borderLeft: isSelected ? "3px solid var(--accent, #00ff88)" : undefined,
        position: "relative",
      }}
      onMouseEnter={(e) => {
        if (!isSelected) {
          e.currentTarget.style.background = "rgba(255, 255, 255, 0.08)";
        }
      }}
      onMouseLeave={(e) => {
        if (!isSelected) {
          e.currentTarget.style.background = "";
        }
      }}>
      <div style={{ flex: 1, textAlign: "left", minWidth: 0 }}>
        <div
          data-tooltip={user.userEmail}
          style={{
            fontWeight: 600,
            fontSize: "0.95rem",
            color: "rgba(255, 255, 255, 0.9)",
            whiteSpace: "nowrap",
            overflow: "visible",
            textOverflow: "ellipsis",
            cursor: "pointer",
            position: "relative",
          }}>
          {user.userName || user.userEmail}
        </div>
      </div>

      <div style={{ display: "flex", gap: "6px", flexShrink: 0 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "6px",
            padding: "0px",
            width: "52px",
            height: "22px",
            background: "rgba(100, 150, 255, 0.15)",
            borderRadius: "6px",
            fontSize: "0.85rem",
            fontWeight: 600,
            color: "rgba(100, 200, 255, 0.9)",
            flexShrink: 0,
          }}>
          <Inbox size={14} />
          <span>{user.submittedCount}</span>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "6px",
            padding: "0px",
            width: "52px",
            height: "22px",
            background: "rgba(81, 207, 102, 0.15)",
            borderRadius: "6px",
            fontSize: "0.85rem",
            fontWeight: 600,
            color: "var(--success, #51cf66)",
            flexShrink: 0,
          }}>
          <Check size={14} />
          <span>{user.acceptedCount}</span>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "6px",
            padding: "0px",
            width: "52px",
            height: "22px",
            background: "rgba(255, 107, 107, 0.15)",
            borderRadius: "6px",
            fontSize: "0.85rem",
            fontWeight: 600,
            color: "var(--error, #ff6b6b)",
            flexShrink: 0,
          }}>
          <X size={14} />
          <span>{user.deniedCount}</span>
        </div>
      </div>
    </button>
  ),
);

CandidateListItem.displayName = 'CandidateListItem';

// Memoized feedback item component
const FeedbackItemCard = memo(
  ({
    item,
    isExpanded,
    onToggle,
  }: {
    item: FeedbackItem;
    isExpanded: boolean;
    onToggle: () => void;
  }) => (
    <div className="feedback-card">
      <div
        onClick={onToggle}
        className={`feedback-card__toggle ${isExpanded ? "expanded" : ""}`}
        onMouseEnter={(e) => {
          if (!isExpanded)
            e.currentTarget.style.background = "rgba(255, 255, 255, 0.03)";
        }}
        onMouseLeave={(e) => {
          if (!isExpanded) e.currentTarget.style.background = "";
        }}>
        {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        <div style={{ flex: 1 }}>
          <div
            style={{
              fontSize: "0.9rem",
              color: "rgba(255,255,255,0.9)",
              fontWeight: "500",
            }}>
            {item.content.substring(0, 100)}
            {item.content.length > 100 ? "..." : ""}
          </div>
          <div
            style={{
              fontSize: "0.8rem",
              color: "rgba(255,255,255,0.5)",
              marginTop: "4px",
            }}>
            {new Date(item.createdAt).toLocaleDateString()}
          </div>
        </div>
      </div>
      {isExpanded && (
        <div
          style={{
            padding: "0 12px 10px 12px",
            borderTop: "1px solid rgba(255, 255, 255, 0.05)",
          }}>
          <div style={{ marginBottom: "8px" }}>
            <div
              style={{
                fontSize: "0.75rem",
                color: "rgba(255,255,255,0.5)",
                marginBottom: "3px",
                marginTop: "3px",
              }}>
              Full Prompt:
            </div>
            <p
              style={{
                fontSize: "0.9rem",
                color: "rgba(255,255,255,0.85)",
                lineHeight: "1.4",
                margin: 0,
                wordBreak: "break-word",
              }}>
              {item.content}
            </p>
          </div>
          {item.feedback.map((fb, idx) => (
            <div key={idx}>{renderFeedback(fb, item.taskKey)}</div>
          ))}
          {item.taskKey && (
            <div
              style={{
                fontSize: "0.85rem",
                color: "rgba(255,255,255,0.5)",
              }}>
              <span style={{ color: "rgba(255,255,255,0.6)" }}>Task Key: </span>
              <code style={{ fontSize: "0.8rem" }}>{item.taskKey}</code>
            </div>
          )}
        </div>
      )}
    </div>
  ),
);

FeedbackItemCard.displayName = 'FeedbackItemCard';

// Helper function to render feedback content
const renderFeedback = (fb: FeedbackDetails, taskKey: string | null) => {
  if (fb.isPositive === 1) {
    return (
      <div
        style={{
          backgroundColor: "rgba(81, 207, 102, 0.08)",
          border: "1px solid rgba(81, 207, 102, 0.2)",
          borderRadius: "6px",
          padding: "8px",
          marginBottom: "8px",
        }}>
        <div
          style={{
            fontSize: "0.75rem",
            color: "var(--success, #51cf66)",
            fontWeight: "600",
            marginBottom: "4px",
          }}>
          ✓ Accepted Feedback:
        </div>
        <p
          style={{
            fontSize: "0.85rem",
            margin: "0",
            color: "rgba(255,255,255,0.8)",
          }}>
          {fb.feedbackContent || "No feedback content"}
        </p>
      </div>
    );
  } else {
    return (
      <div>
        {fb.feedbackContent && (
          <div
            style={{
              backgroundColor: "rgba(255, 107, 107, 0.08)",
              border: "1px solid rgba(255, 107, 107, 0.2)",
              borderRadius: "6px",
              padding: "8px",
              marginBottom: "8px",
            }}>
            <div
              style={{
                fontSize: "0.75rem",
                color: "var(--error, #ff6b6b)",
                fontWeight: "600",
                marginBottom: "4px",
              }}>
              📝 Feedback:
            </div>
            <p
              style={{
                fontSize: "0.85rem",
                margin: "0",
                color: "rgba(255,255,255,0.8)",
              }}>
              {fb.feedbackContent}
            </p>
          </div>
        )}

        {fb.rejectionReason && (
          <div
            style={{
              backgroundColor: "rgba(255, 107, 107, 0.08)",
              border: "1px solid rgba(255, 107, 107, 0.2)",
              borderRadius: "6px",
              padding: "8px",
              marginBottom: "8px",
            }}>
            <div
              style={{
                fontSize: "0.75rem",
                color: "var(--error, #ff6b6b)",
                fontWeight: "600",
                marginBottom: "4px",
              }}>
              ⚠️ Rejection Reason:
            </div>
            <p
              style={{
                fontSize: "0.85rem",
                margin: "0",
                color: "rgba(255,255,255,0.8)",
              }}>
              {fb.rejectionReason || "No reason provided"}
            </p>
          </div>
        )}
      </div>
    );
  }
};

export default function CandidateReview() {
  const searchParams = useSearchParams();
  const { selectedProjectId, loading: projectsLoading } = useProjects({
    autoSelectFirst: true,
    initialProjectId: searchParams?.get("projectId") || "",
  });

  const [userStats, setUserStats] = useState<FeedbackStats[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [feedbackItems, setFeedbackItems] = useState<FeedbackItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedPrompts, setExpandedPrompts] = useState<Set<string>>(
    new Set(),
  );
  const [candidateStatus, setCandidateStatus] = useState<string | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [statusFilter, setStatusFilter] = useState<
    "all" | "accepted" | "rejected"
  >("all");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [candidateStatuses, setCandidateStatuses] = useState<
    Map<string, string>
  >(new Map());
  const pendingStatusUpdateRef = useRef<AbortController | null>(null);
  const candidateStatusesRef = useRef<Map<string, string>>(candidateStatuses);

  // Keep candidateStatusesRef in sync with candidateStatuses state
  useEffect(() => {
    candidateStatusesRef.current = candidateStatuses;
  }, [candidateStatuses]);

  // Fetch user stats when project changes
  useEffect(() => {
    if (!selectedProjectId) return;

    const fetchUserStats = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(
          `/api/candidates?projectId=${selectedProjectId}`,
        );

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`API error: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        if (data.error) throw new Error(data.error);

        setUserStats(data.userStats || []);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to fetch user stats",
        );
      } finally {
        setLoading(false);
      }
    };

    fetchUserStats();
  }, [selectedProjectId]);

  // Fetch feedback details when user is selected
  useEffect(() => {
    if (!selectedProjectId || !selectedUserId) {
      setFeedbackItems([]);
      return;
    }

    const fetchFeedbackDetails = async () => {
      setLoadingDetails(true);
      setError(null);
      try {
        // Fetch feedback details
        const feedbackResponse = await fetch(
          `/api/candidates?projectId=${selectedProjectId}&userId=${selectedUserId}&action=details`,
        );

        if (!feedbackResponse.ok) {
          const errorText = await feedbackResponse.text();
          throw new Error(
            `API error: ${feedbackResponse.status} - ${errorText}`,
          );
        }

        const feedbackData = await feedbackResponse.json();
        if (feedbackData.error) throw new Error(feedbackData.error);

        setFeedbackItems(feedbackData.tasks || []);

        // Get status from the already-fetched candidateStatuses map
        const status = candidateStatusesRef.current.get(selectedUserId);
        setCandidateStatus(status || null);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to fetch feedback",
        );
      } finally {
        setLoadingDetails(false);
      }
    };

    fetchFeedbackDetails();
  }, [selectedProjectId, selectedUserId]);

  const selectedUserStats = useMemo(
    () => userStats.find((u) => u.userId === selectedUserId),
    [userStats, selectedUserId],
  );

  const acceptedFeedback = useMemo(
    () =>
      feedbackItems.filter((item) =>
        item.feedback.some((f) => f.isPositive === 1),
      ),
    [feedbackItems],
  );

  const deniedFeedback = useMemo(
    () =>
      feedbackItems.filter((item) =>
        item.feedback.some((f) => f.isPositive === 0),
      ),
    [feedbackItems],
  );

  useEffect(() => {
    if (!selectedProjectId || userStats.length === 0) return;

    const fetchAllStatuses = async () => {
      try {
        const response = await fetch(
          `/api/candidates?projectId=${selectedProjectId}&action=all-statuses`,
        );
        if (response.ok) {
          const data = await response.json();
          const statuses = new Map<string, string>();
          data.statuses.forEach((s: { userId: string; status: string }) => {
            statuses.set(s.userId, s.status);
          });
          setCandidateStatuses(statuses);
        }
      } catch (err) {
        // Silently fail for status fetch
      }
    };

    fetchAllStatuses();
  }, [selectedProjectId, userStats]);

  const filteredCandidates = useMemo(() => {
    // Helper function to extract last name from display name
    const getLastName = (name: string | null, email: string): string => {
      if (!name) return email; // Use email if no name

      // If it's an email, return it
      if (name.includes('@')) return name;

      // Split name into parts
      const parts = name.trim().split(/\s+/);

      // If only one part, return it
      if (parts.length === 1) return parts[0];

      // Return the last part (assumed to be last name)
      return parts[parts.length - 1];
    };

    const filtered = userStats.filter((user) => {
      // Filter by status
      if (statusFilter !== "all") {
        const status = candidateStatuses.get(user.userId);
        if (statusFilter === "accepted" && status !== "ACCEPTED") return false;
        if (statusFilter === "rejected" && status !== "REJECTED") return false;
      }

      // Filter by search term
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        const nameMatch = user.userName?.toLowerCase().includes(searchLower);
        const emailMatch = user.userEmail.toLowerCase().includes(searchLower);
        return nameMatch || emailMatch;
      }

      return true;
    });

    // Sort alphabetically by last name (case-insensitive)
    return filtered.sort((a, b) => {
      const lastNameA = getLastName(a.userName, a.userEmail);
      const lastNameB = getLastName(b.userName, b.userEmail);
      return lastNameA.localeCompare(lastNameB, undefined, { sensitivity: 'base' });
    });
  }, [userStats, statusFilter, searchTerm, candidateStatuses]);

  const togglePrompt = (promptId: string) => {
    setExpandedPrompts((prev) => {
      const next = new Set(prev);
      next.has(promptId) ? next.delete(promptId) : next.add(promptId);
      return next;
    });
  };

  const handleSelectUser = useCallback((userId: string) => {
    setSelectedUserId(userId);
  }, []);

  const handleCandidateStatusChange = async (newStatus: string) => {
    if (!selectedUserId || !selectedProjectId) return;

    // Cancel any pending request
    if (pendingStatusUpdateRef.current) {
      pendingStatusUpdateRef.current.abort();
    }

    // Create new abort controller for this request
    const abortController = new AbortController();
    pendingStatusUpdateRef.current = abortController;

    // Store previous status values for rollback
    const previousStatus = candidateStatus;
    const previousStatuses = new Map(candidateStatuses);

    // Optimistic update - show the change immediately
    setCandidateStatus(newStatus);
    setCandidateStatuses((prev) => {
      const next = new Map(prev);
      next.set(selectedUserId, newStatus);
      return next;
    });
    setUpdatingStatus(true);

    try {
      const response = await fetch("/api/candidates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: selectedUserId,
          projectId: selectedProjectId,
          status: newStatus,
          email: selectedUserStats?.userEmail || "",
        }),
        signal: abortController.signal,
      });

      if (!response.ok) {
        throw new Error("Failed to update candidate status");
      }
    } catch (err) {
      // Ignore abort errors
      if (err instanceof Error && err.name === 'AbortError') {
        return;
      }
      setError(err instanceof Error ? err.message : "Failed to update status");
      // Revert to previous state on error
      setCandidateStatus(previousStatus);
      setCandidateStatuses(previousStatuses);
    } finally {
      // Only clear updating status if this is still the current request
      if (pendingStatusUpdateRef.current === abortController) {
        setUpdatingStatus(false);
        pendingStatusUpdateRef.current = null;
      }
    }
  };

  if (projectsLoading) {
    return (
      <div style={{ textAlign: "center", padding: "100px" }}>
        <h2>Loading projects...</h2>
      </div>
    );
  }

  if (!selectedProjectId) {
    return (
      <div style={{ textAlign: "center", padding: "100px" }}>
        <h2>No project selected</h2>
      </div>
    );
  }

  return (
    <div
      style={{
        width: "100%",
        display: "flex",
        flexDirection: "column",
      }}>
      <div style={{ marginBottom: "12px" }}>
        <h1
          className="premium-gradient"
          style={{ fontSize: "1.5rem", marginBottom: "8px" }}>
          Candidate Review
        </h1>
        <p style={{ color: "rgba(255,255,255,0.6)" }}>
          Review prompt submissions and feedback by candidate
        </p>
      </div>
      <main
        style={{
          display: "grid",
          gridTemplateColumns: "460px 1fr",
          gap: "24px",
          height: "calc(100vh - 280px)",
        }}>
        <div
          style={{
            background: "rgba(255, 255, 255, 0.05)",
            border: "1px solid rgba(255, 255, 255, 0.1)",
            borderRadius: "12px",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            height: "100%",
          }}>
          <div
            style={{
              padding: "20px",
              borderBottom: "1px solid rgba(255,255,255,0.1)",
              display: "flex",
              flexDirection: "column",
              gap: "12px",
            }}>
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: "0.85rem",
                  color: "rgba(255,255,255,0.7)",
                  fontWeight: 600,
                  marginBottom: "8px",
                }}>
                Search:
              </label>
              <input
                type="text"
                placeholder="Search by name or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  borderRadius: "6px",
                  border: "1px solid rgba(255,255,255,0.1)",
                  background: "rgba(0,0,0,0.3)",
                  color: "rgba(255,255,255,0.9)",
                  fontSize: "0.9rem",
                  outline: "none",
                }}
              />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <label
                style={{
                  fontSize: "0.85rem",
                  color: "rgba(255,255,255,0.7)",
                  fontWeight: 600,
                  whiteSpace: "nowrap",
                }}>
                Status:
              </label>
              <select
                value={statusFilter}
                onChange={(e) =>
                  setStatusFilter(
                    e.target.value as "all" | "accepted" | "rejected",
                  )
                }
                style={{
                  padding: "6px 12px",
                  borderRadius: "6px",
                  fontSize: "0.9rem",
                  fontWeight: 500,
                  border: "1px solid rgba(255,255,255,0.2)",
                  backgroundColor: "rgba(0,0,0,0.4)",
                  color: "rgba(255,255,255,0.9)",
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                }}>
                <option value="all">All</option>
                <option value="accepted">Accepted</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
          </div>

          {loading ? (
            <div style={{ padding: "20px", textAlign: "center", opacity: 0.5 }}>
              Loading users...
            </div>
          ) : error ? (
            <div
              style={{
                padding: "20px",
                color: "var(--error, #ff6b6b)",
                textAlign: "center",
              }}>
              {error}
            </div>
          ) : userStats.length === 0 ? (
            <div style={{ padding: "20px", textAlign: "center", opacity: 0.5 }}>
              <Inbox size={32} style={{ margin: "0 auto 8px", opacity: 0.3 }} />
              <p>No feedback submissions found</p>
            </div>
          ) : filteredCandidates.length === 0 ? (
            <div style={{ padding: "20px", textAlign: "center", opacity: 0.5 }}>
              <p>No candidates match the selected filter</p>
            </div>
          ) : (
            <div
              style={{
                flex: 1,
                overflowY: "auto",
                display: "flex",
                flexDirection: "column",
              }}>
              {filteredCandidates.map((user) => (
                <CandidateListItem
                  key={user.userId}
                  user={user}
                  isSelected={selectedUserId === user.userId}
                  onSelect={() => handleSelectUser(user.userId)}
                />
              ))}
            </div>
          )}
        </div>

        <div
          style={{
            background: "rgba(255, 255, 255, 0.05)",
            border: "1px solid rgba(255, 255, 255, 0.1)",
            borderRadius: "12px",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            height: "100%",
          }}>
          {selectedUserId && selectedUserStats ? (
            <>
              <div
                style={{
                  padding: "20px",
                  borderBottom: "1px solid rgba(255,255,255,0.1)",
                }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "24px",
                  }}>
                  {/* Left: Name and Stats */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "12px",
                        marginBottom: "12px",
                      }}>
                      <h2
                        title={selectedUserStats.userEmail}
                        style={{
                          fontSize: "1.2rem",
                          margin: 0,
                          cursor: "pointer",
                          wordBreak: "break-word",
                        }}>
                        {selectedUserStats.userName ||
                          selectedUserStats.userEmail}
                      </h2>
                      {candidateStatus && (
                        <span
                          style={{
                            padding: "4px 10px",
                            borderRadius: "6px",
                            fontSize: "0.8rem",
                            fontWeight: 600,
                            backgroundColor:
                              candidateStatus === "ACCEPTED"
                                ? "rgba(34, 197, 94, 0.2)"
                                : "rgba(239, 68, 68, 0.2)",
                            color:
                              candidateStatus === "ACCEPTED"
                                ? "#22c55e"
                                : "#ef4444",
                          }}>
                          {candidateStatus === "ACCEPTED"
                            ? "✓ Accepted"
                            : "✕ Rejected"}
                        </span>
                      )}
                    </div>
                    <div
                      style={{
                        display: "flex",
                        gap: "24px",
                        fontSize: "0.95rem",
                      }}>
                      <div>
                        <span style={{ color: "rgba(255,255,255,0.5)" }}>
                          Accepted:{" "}
                        </span>
                        <span
                          style={{
                            color: "var(--success, #51cf66)",
                            fontWeight: "600",
                          }}>
                          {selectedUserStats.acceptedCount}
                        </span>
                      </div>
                      <div>
                        <span style={{ color: "rgba(255,255,255,0.5)" }}>
                          Denied:{" "}
                        </span>
                        <span
                          style={{
                            color: "var(--error, #ff6b6b)",
                            fontWeight: "600",
                          }}>
                          {selectedUserStats.deniedCount}
                        </span>
                      </div>
                    </div>
                  </div>

                  {selectedUserStats && (
                    <div
                      style={{
                        display: "flex",
                        gap: "12px",
                        flexShrink: 0,
                        flexDirection: "column",
                        alignItems: "flex-start",
                      }}>
                      <div
                        style={{
                          display: "flex",
                          gap: "6px",
                          background: "rgba(0,0,0,0.2)",
                          padding: "4px",
                          borderRadius: "8px",
                        }}>
                        <button
                          onClick={() =>
                            handleCandidateStatusChange("ACCEPTED")
                          }
                          disabled={updatingStatus}
                          className={`candidate-action-btn accept ${candidateStatus === "ACCEPTED" ? "active" : ""}`}
                          aria-pressed={candidateStatus === "ACCEPTED"}>
                          Accept Candidate
                        </button>
                        <button
                          onClick={() =>
                            handleCandidateStatusChange("REJECTED")
                          }
                          disabled={updatingStatus}
                          className={`candidate-action-btn reject ${candidateStatus === "REJECTED" ? "active" : ""}`}
                          aria-pressed={candidateStatus === "REJECTED"}>
                          Reject Candidate
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div style={{ flex: 1, overflowY: "auto", padding: "20px" }}>
                {loadingDetails ? (
                  <div
                    style={{
                      padding: "40px",
                      textAlign: "center",
                      opacity: 0.5,
                    }}>
                    Loading feedback...
                  </div>
                ) : feedbackItems.length === 0 ? (
                  <div
                    style={{
                      padding: "40px",
                      textAlign: "center",
                      opacity: 0.5,
                    }}>
                    <Inbox
                      size={32}
                      style={{ margin: "0 auto 8px", opacity: 0.3 }}
                    />
                    <p>No feedback submissions</p>
                  </div>
                ) : (
                  <div>
                    {acceptedFeedback.length > 0 && (
                      <div style={{ marginBottom: "28px" }}>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                            marginBottom: "14px",
                            paddingBottom: "10px",
                            borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
                          }}>
                          <Check
                            size={18}
                            style={{ color: "var(--success, #51cf66)" }}
                          />
                          <h3
                            style={{
                              fontSize: "1.05rem",
                              margin: 0,
                              color: "rgba(255, 255, 255, 0.9)",
                            }}>
                            Accepted ({acceptedFeedback.length})
                          </h3>
                        </div>
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: "10px",
                          }}>
                          {acceptedFeedback.map((item) => (
                            <FeedbackItemCard
                              key={item.id}
                              item={item}
                              isExpanded={expandedPrompts.has(item.id)}
                              onToggle={() => togglePrompt(item.id)}
                            />
                          ))}
                        </div>
                      </div>
                    )}

                    {deniedFeedback.length > 0 && (
                      <div style={{ marginBottom: "0" }}>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                            marginBottom: "14px",
                            paddingBottom: "10px",
                            borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
                          }}>
                          <X
                            size={18}
                            style={{ color: "var(--error, #ff6b6b)" }}
                          />
                          <h3
                            style={{
                              fontSize: "1.05rem",
                              margin: 0,
                              color: "rgba(255, 255, 255, 0.9)",
                            }}>
                            Denied ({deniedFeedback.length})
                          </h3>
                        </div>
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: "10px",
                          }}>
                          {deniedFeedback.map((item) => (
                            <FeedbackItemCard
                              key={item.id}
                              item={item}
                              isExpanded={expandedPrompts.has(item.id)}
                              onToggle={() => togglePrompt(item.id)}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div style={{ padding: "40px", textAlign: "center", opacity: 0.5 }}>
              <Inbox size={32} style={{ margin: "0 auto 8px", opacity: 0.3 }} />
              <p>Select a candidate to view their feedback</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
