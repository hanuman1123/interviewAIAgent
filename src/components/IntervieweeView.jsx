import React from "react";
import { useSelector, useDispatch } from "react-redux";
import ResumeUpload from "./ResumeUpload";
import InfoCollector from "./InfoCollector";
import InterviewScreen from "./InterviewScreen";
import { restartInterviewKeepCandidate } from "../features/interview/interviewSlice";

function IntervieweeView() {
  const { status: interviewStatus, finalScore } = useSelector(
    (state) => state.interview.currentInterview || {}
  );
  const dispatch = useDispatch();

  const renderContent = () => {
    switch (interviewStatus) {
      case "idle":
      case undefined:
        return <ResumeUpload />;

      case "collecting_info":
        return <InfoCollector />;

      case "in_progress":
        return <InterviewScreen />;

      case "completed":
        return (
          <div className="text-center">
            <h2 className="text-3xl font-bold mb-4">Interview Complete!</h2>
            <p className="text-xl">Your final score is:</p>
            <p className="text-6xl font-bold text-primary my-4">
              {finalScore !== null ? finalScore : "N/A"} / 10
            </p>
            <p>You can close this tab now. The interviewer can see your results.</p>

            <div className="mt-6 flex justify-center gap-4">
              <button
                className="btn btn-secondary"
                onClick={() => dispatch(restartInterviewKeepCandidate())}
              >
                Restart Exam
              </button>
            </div>
          </div>
        );

      default:
        return <ResumeUpload />;
    }
  };

  return (
    <div className="p-6 bg-base-100 rounded-box shadow-xl min-h-[60vh] flex items-center justify-center">
      {renderContent()}
    </div>
  );
}

export default IntervieweeView;
