"use client";

import { useState, useEffect } from "react";

interface PromptInfo {
  id: string;
  content: string;
  createdByName: string | null;
  createdByEmail: string | null;
  createdAt: string;
}

interface RedZonePair {
  prompt1: PromptInfo;
  prompt2: PromptInfo;
  similarity: number;
}

interface RedZoneModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  threshold?: number;
}

export default function RedZoneModal({ isOpen, onClose, projectId, threshold = 70 }: RedZoneModalProps) {
  const [pairs, setPairs] = useState<RedZonePair[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalPrompts, setTotalPrompts] = useState(0);

  useEffect(() => {
    if (!isOpen || !projectId) return;

    const fetchRedZone = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(
          `/api/analytics/red-zone?projectId=${projectId}&threshold=${threshold}`
        );
        const data = await response.json();

        if (data.error) {
          setError(data.error);
          return;
        }

        setPairs(data.pairs);
        setTotalPrompts(data.totalPrompts);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Failed to fetch");
      } finally {
        setLoading(false);
      }
    };

    fetchRedZone();
  }, [isOpen, projectId, threshold]);

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0, 0, 0, 0.7)",
        backdropFilter: "blur(4px)",
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "var(--glass, #1a1a1a)",
          borderRadius: "16px",
          border: "1px solid var(--border, #333)",
          width: "90%",
          maxWidth: "800px",
          maxHeight: "80vh",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: "20px 24px",
            borderBottom: "1px solid var(--border, #333)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "10px",
                background: "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "20px",
              }}
            >
              🚨
            </div>
            <div>
              <h2
                style={{
                  margin: 0,
                  fontSize: "18px",
                  fontWeight: 600,
                  color: "rgba(255,255,255,0.95)",
                }}
              >
                Red Zone Prompts
              </h2>
              <p
                style={{
                  margin: 0,
                  fontSize: "13px",
                  color: "rgba(255,255,255,0.5)",
                }}
              >
                Prompts with ≥{threshold}% similarity that need review
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "rgba(255,255,255,0.1)",
              border: "none",
              borderRadius: "8px",
              width: "36px",
              height: "36px",
              cursor: "pointer",
              color: "rgba(255,255,255,0.7)",
              fontSize: "18px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "all 0.2s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(255,255,255,0.15)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "rgba(255,255,255,0.1)";
            }}
          >
            ✕
          </button>
        </div>

        {/* Stats bar */}
        <div
          style={{
            padding: "12px 24px",
            borderBottom: "1px solid var(--border, #333)",
            background: "rgba(239, 68, 68, 0.1)",
            display: "flex",
            gap: "24px",
            fontSize: "13px",
          }}
        >
          <div>
            <span style={{ color: "rgba(255,255,255,0.5)" }}>Total Prompts: </span>
            <span style={{ color: "rgba(255,255,255,0.9)", fontWeight: 600 }}>
              {totalPrompts}
            </span>
          </div>
          <div>
            <span style={{ color: "rgba(255,255,255,0.5)" }}>Red Zone Pairs: </span>
            <span style={{ color: "#ef4444", fontWeight: 600 }}>{pairs.length}</span>
          </div>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 24px" }}>
          {loading ? (
            <div
              style={{
                textAlign: "center",
                padding: "60px 20px",
                color: "rgba(255,255,255,0.5)",
              }}
            >
              <div
                style={{
                  width: "32px",
                  height: "32px",
                  border: "3px solid rgba(239, 68, 68, 0.2)",
                  borderTopColor: "#ef4444",
                  borderRadius: "50%",
                  animation: "spin 1s linear infinite",
                  margin: "0 auto 16px",
                }}
              />
              Scanning for high-similarity prompts...
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
          ) : error ? (
            <div
              style={{
                padding: "20px",
                background: "rgba(239, 68, 68, 0.1)",
                borderRadius: "8px",
                color: "#fca5a5",
                border: "1px solid rgba(239, 68, 68, 0.2)",
              }}
            >
              {error}
            </div>
          ) : pairs.length === 0 ? (
            <div
              style={{
                textAlign: "center",
                padding: "60px 20px",
                color: "rgba(255,255,255,0.5)",
              }}
            >
              <div style={{ fontSize: "48px", marginBottom: "16px" }}>✅</div>
              <div style={{ fontSize: "16px", fontWeight: 500, marginBottom: "8px" }}>
                No Red Zone Prompts Found
              </div>
              <div style={{ fontSize: "13px" }}>
                All prompts have less than {threshold}% similarity
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {pairs.map((pair, index) => (
                <div
                  key={`${pair.prompt1.id}-${pair.prompt2.id}`}
                  style={{
                    background: "rgba(255,255,255,0.03)",
                    borderRadius: "12px",
                    border: "1px solid var(--border, #333)",
                    overflow: "hidden",
                  }}
                >
                  {/* Pair header */}
                  <div
                    style={{
                      padding: "12px 16px",
                      background: "rgba(239, 68, 68, 0.15)",
                      borderBottom: "1px solid var(--border, #333)",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "13px",
                        color: "rgba(255,255,255,0.6)",
                        fontWeight: 500,
                      }}
                    >
                      Pair #{index + 1}
                    </span>
                    <span
                      style={{
                        fontSize: "16px",
                        fontWeight: 700,
                        color: "#ef4444",
                      }}
                    >
                      {pair.similarity}% match
                    </span>
                  </div>

                  {/* Two prompts side by side */}
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: "1px",
                      background: "var(--border, #333)",
                    }}
                  >
                    {[pair.prompt1, pair.prompt2].map((prompt, i) => (
                      <div
                        key={prompt.id}
                        style={{
                          padding: "14px 16px",
                          background: "var(--glass, #1a1a1a)",
                        }}
                      >
                        <div
                          style={{
                            fontSize: "11px",
                            color: "rgba(255,255,255,0.4)",
                            marginBottom: "8px",
                            textTransform: "uppercase",
                            letterSpacing: "0.5px",
                          }}
                        >
                          {prompt.createdByName || prompt.createdByEmail || "Unknown User"}
                        </div>
                        <div
                          style={{
                            fontSize: "13px",
                            lineHeight: "1.5",
                            color: "rgba(255,255,255,0.85)",
                            maxHeight: "80px",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {prompt.content}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
