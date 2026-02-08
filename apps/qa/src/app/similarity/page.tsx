import { Suspense } from "react";
import PromptSimilarityPage from "./similarity-content";

export const metadata = {
  title: "Prompt Similarity Analysis",
  description: "Analyze similarity between prompts from the same user.",
};

export default function SimilarityPage() {
  return (
    <Suspense
      fallback={
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            height: "calc(100vh - 60px)",
            color: "rgba(255,255,255,0.4)",
          }}
        >
          <p>Loading...</p>
        </div>
      }
    >
      <PromptSimilarityPage />
    </Suspense>
  );
}
