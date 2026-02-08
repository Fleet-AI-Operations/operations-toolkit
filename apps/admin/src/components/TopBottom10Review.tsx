"use client";

import { useEffect, useState, useCallback } from "react";
import { useProjects } from '@/hooks/useProjects';
import { useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight, Check, X, Inbox } from "lucide-react";

interface ReviewRecord {
  id: string;
  content: string;
  category: "TOP_10" | "BOTTOM_10";
  source: string;
  metadata: Record<string, any> | null;
  alignmentAnalysis: string | null;
  isCategoryCorrect: boolean | null;
  reviewedBy: string | null;
}

export default function TopBottom10Review() {
  const searchParams = useSearchParams();
  const { selectedProjectId, setSelectedProjectId } = useProjects({ initialProjectId: searchParams.get("projectId") || undefined });

  const [category, setCategory] = useState<"TOP_10" | "BOTTOM_10">("TOP_10");
  const [allRecords, setAllRecords] = useState<ReviewRecord[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const [hovered, setHovered] = useState<"TOP_10" | "BOTTOM_10" | null>(null);

  // Filter records by current category
  const records = allRecords.filter((r) => r.category === category);

  // Helper function to get category button background
  const getCategoryButtonBg = (btnCategory: "TOP_10" | "BOTTOM_10") => {
    if (category === btnCategory) {
      return btnCategory === "TOP_10" ? "#16a34a" : "#dc2626";
    }
    return hovered === btnCategory ? "#374151" : "transparent";
  };

  // Projects and selectedProjectId are provided by ProjectContext via useProjects

  useEffect(() => {
    if (selectedProjectId) {
      fetchRecords();
    } else {
      setAllRecords([]);
      setCurrentIndex(0);
      setError(null);
      setLoading(false);
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

      // Fetch all TOP_10 and BOTTOM_10 records in one call
      const response = await fetch(
        `/api/records/topbottom-review?projectId=${selectedProjectId}`,
      );

      if (!response.ok) {
        throw new Error("Failed to fetch records");
      }

      const data = await response.json();

      setAllRecords(data.records);

      // Set initial category to whichever has records (prioritizing TOP_10)
      const hasTopRecords = data.records.some((r: ReviewRecord) => r.category === "TOP_10");
      const hasBottomRecords = data.records.some((r: ReviewRecord) => r.category === "BOTTOM_10");
      
      setCategory(hasTopRecords ? "TOP_10" : "BOTTOM_10");
      setCurrentIndex(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      setAllRecords([]);
    } finally {
      setLoading(false);
    }
  };

  const currentRecord = records[currentIndex];

  const reviewPrompt = async (agreeWithRating: boolean) => {
    if (!currentRecord) {
      return;
    }

    try {
      setReviewing(true);
      const response = await fetch("/api/records/topbottom-review/update", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recordId: currentRecord.id,
          isCategoryCorrect: agreeWithRating,
          reviewedBy: "admin", // TODO: Fetch actual user from Supabase session (auth.getUser())
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to update record");
      }

      // Remove the reviewed record from the list
      const newAllRecords = allRecords.filter((r) => r.id !== currentRecord.id);
      setAllRecords(newAllRecords);

      // Get updated filtered records for current category
      const newRecords = newAllRecords.filter((r) => r.category === category);

      if (newRecords.length === 0) {
        // No more records in this category, switch to the other one if it has records
        const otherCategory = category === "TOP_10" ? "BOTTOM_10" : "TOP_10";
        const hasOtherRecords = newAllRecords.some((r) => r.category === otherCategory);
        
        if (hasOtherRecords) {
          setCategory(otherCategory);
        }
        setCurrentIndex(0);
      } else if (currentIndex >= newRecords.length) {
        setCurrentIndex(newRecords.length - 1);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit review");
    } finally {
      setReviewing(false);
    }
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const handleNext = () => {
    if (currentIndex < records.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  return (
    <div style={{ width: "100%", maxWidth: "1200px", margin: "0 auto" }}>
      <div style={{ marginBottom: "12px" }}>
        <h1 className="premium-gradient" style={{ fontSize: "1.5rem", paddingBottom: "8px" }}>Review Top/Bottom 10%</h1>
        <p style={{ color: "rgba(255,255,255,0.6)" }}>Verify and correct automated percentage classifications</p>
      </div>

      {/* Project selection is handled in the header; no inline project dropdown here. */}

      { !selectedProjectId ? (
        <div style={{ padding: '80px', textAlign: 'center' }}>
          <Inbox size={48} style={{ margin: '0 auto 16px', opacity: 0.3 }} />
          <div style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '8px', opacity: 0.6 }}>
            No project selected
          </div>
          <div style={{ fontSize: '0.9rem', opacity: 0.4 }}>
            Select a project from the dropdown above to view records
          </div>
        </div>
      ) : loading ? (
        <div
          style={{
            textAlign: "center",
            color: "#60a5fa",
            padding: "40px 20px",
          }}
        >
          <p>Loading records...</p>
        </div>
      ) : error ? (
        <div
          style={{
            textAlign: "center",
            color: "#f87171",
            padding: "40px 20px",
          }}
        >
          <p>Error: {error}</p>
          <button
            onClick={() => fetchRecords()}
            style={{
              marginTop: "20px",
              padding: "8px 16px",
              backgroundColor: "#2563eb",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
            }}
          >
            Retry
          </button>
        </div>
      ) : allRecords.length === 0 ? (
          <div className="glass-card" style={{ textAlign: "center", padding: "60px 20px" }}>
            <Inbox size={48} style={{ margin: '0 auto 16px', opacity: 0.3 }} />
            <div style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '8px', opacity: 0.6 }}>No prompts found</div>
            <div style={{ fontSize: '0.9rem', opacity: 0.4 }}>There are no Top/Bottom prompts to review for this project</div>
          </div>
      ) : (
        <>
          <div style={{ display: "flex", gap: "12px", marginBottom: "20px" }}>
            <button
              onClick={() => {
                setCategory("TOP_10");
                setCurrentIndex(0);
              }}
              onMouseEnter={() => setHovered("TOP_10")}
              onMouseLeave={() => setHovered(null)}
              style={{
                padding: "6px 16px",
                borderRadius: "4px",
                fontWeight: "600",
                border: "none",
                cursor: "pointer",
                fontSize: "14px",
                backgroundColor: getCategoryButtonBg("TOP_10"),
                color: "white",
                transition: "all 0.2s",
              }}
            >
              Top 10
            </button>
            <button
              onClick={() => {
                setCategory("BOTTOM_10");
                setCurrentIndex(0);
              }}
              onMouseEnter={() => setHovered("BOTTOM_10")}
              onMouseLeave={() => setHovered(null)}
              style={{
                padding: "6px 16px",
                borderRadius: "4px",
                fontWeight: "600",
                border: "none",
                cursor: "pointer",
                fontSize: "14px",
                backgroundColor: getCategoryButtonBg("BOTTOM_10"),
                color: "white",
                transition: "all 0.2s",
              }}
            >
              Bottom 10
            </button>
          </div>

          <div
            style={{
              padding: "12px",
              marginBottom: "16px",
              border: "1px solid #374151",
              borderRadius: "8px",
              backgroundColor: "rgba(15, 23, 42, 0.5)",
              display: "flex",
              flexDirection: "column",
              gap: "12px",
              maxHeight: "calc(100vh - 180px)",
              minHeight: "320px",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "4px",
              }}
            >
              <span style={{ color: "#9ca3af", fontSize: "12px" }}>
                  Prompt {currentIndex + 1} of {records.length}
                </span>
            </div>

            <div>
              <h2
                style={{
                  fontSize: "14px",
                  fontWeight: "600",
                  color: "white",
                  marginBottom: "8px",
                }}
              >
                Prompt:
              </h2>
              <div
                style={{
                  backgroundColor: "#111827",
                  padding: "12px",
                  borderRadius: "4px",
                  border: "1px solid #4b5563",
                  height: "400px",
                  overflowY: "auto",
                }}
              >
                <p
                  style={{
                    color: "#e5e7eb",
                    whiteSpace: "pre-wrap",
                    fontSize: "13px",
                    lineHeight: "1.4",
                  }}
                >
                  {currentRecord?.content}
                </p>
              </div>
            </div>

            <div
              style={{
                padding: "10px",
                backgroundColor: "rgba(30, 58, 138, 0.2)",
                border: "1px solid rgba(59, 130, 246, 0.5)",
                borderRadius: "4px",
                fontSize: "13px",
              }}
            >
                <p style={{ color: "white", fontWeight: "600", margin: 0 }}>
                Is this prompt correctly classified as{" "}
                {category === "TOP_10" ? "TOP 10" : "BOTTOM 10"}?
              </p>
            </div>

            <div style={{ display: "flex", gap: "12px" }}>
              <button
                onClick={() => reviewPrompt(true)}
                disabled={reviewing}
                style={{
                  flex: 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "6px",
                  padding: "10px 16px",
                  backgroundColor: "#16a34a",
                  border: "none",
                  borderRadius: "4px",
                  fontWeight: "600",
                  color: "white",
                  fontSize: "13px",
                  cursor: reviewing ? "not-allowed" : "pointer",
                  opacity: reviewing ? 0.5 : 1,
                  transition: "all 0.2s",
                }}
              >
                <Check size={16} /> Yes
              </button>
              <button
                onClick={() => reviewPrompt(false)}
                disabled={reviewing}
                style={{
                  flex: 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "6px",
                  padding: "10px 16px",
                  backgroundColor: "#dc2626",
                  border: "none",
                  borderRadius: "4px",
                  fontWeight: "600",
                  color: "white",
                  fontSize: "13px",
                  cursor: reviewing ? "not-allowed" : "pointer",
                  opacity: reviewing ? 0.5 : 1,
                  transition: "all 0.2s",
                }}
              >
                <X size={16} /> No
              </button>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              gap: "24px",
              justifyContent: "center",
              alignItems: "center",
              marginTop: "20px",
            }}
          >
            <button
              onClick={handlePrevious}
              disabled={currentIndex === 0}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                background: "none",
                border: "none",
                cursor: currentIndex === 0 ? "not-allowed" : "pointer",
                opacity: currentIndex === 0 ? 0.5 : 0.7,
                color: "white",
                fontSize: "14px",
                fontWeight: "500",
                padding: 0,
              }}
            >
              <ChevronLeft size={20} /> Previous
            </button>
            <button
              onClick={handleNext}
              disabled={currentIndex === records.length - 1}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                background: "none",
                border: "none",
                cursor:
                  currentIndex === records.length - 1
                    ? "not-allowed"
                    : "pointer",
                opacity: currentIndex === records.length - 1 ? 0.5 : 0.7,
                color: "white",
                fontSize: "14px",
                fontWeight: "500",
                padding: 0,
              }}
            >
              Next <ChevronRight size={20} />
            </button>
          </div>
        </>
      )}
    </div>
  );
}
