import CandidateReview from "@/components/CandidateReview";
import { ErrorBoundary } from "@/components/ErrorBoundary";

export const metadata = {
  title: "Candidate Review",
  description: "Review candidate submissions and feedback",
};

export default function CandidateReviewPage() {
  return (
    <ErrorBoundary>
      <CandidateReview />
    </ErrorBoundary>
  );
}
