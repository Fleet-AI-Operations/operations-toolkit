import { Suspense } from "react";
import LikertScoring from "@/components/LikertScoring";

export const metadata = {
    title: "Likert Scoring",
    description: "Rate prompts on Realism and Quality using Likert scales",
};

export default function LikertScoringPage() {
    return (
        <Suspense fallback={<div style={{ textAlign: "center", padding: "60px", color: "#60a5fa" }}>Loading...</div>}>
            <LikertScoring />
        </Suspense>
    );
}
