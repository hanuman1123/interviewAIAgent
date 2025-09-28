// src/App.jsx
import React, { useState, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import IntervieweeView from "./components/IntervieweeView";
import InterviewerDashboard from "./components/InterviewerDashboard";
import { saveSession } from "./features/interview/interviewSlice";

export default function App() {
  const [activeTab, setActiveTab] = useState("interviewee");

  const dispatch = useDispatch();
  const interviewStatus = useSelector((state) => state.interview.currentInterview?.status);

  // When the user refreshes or closes the tab, save the current session so it
  // can be resumed later. We only save when the user is in collecting_info or
  // in_progress to avoid storing empty sessions.
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (interviewStatus === "in_progress" || interviewStatus === "collecting_info") {
        // best-effort save; errors ignored
        dispatch(saveSession());
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [dispatch, interviewStatus]);

  return (
    <div className="min-h-screen bg-base-200 flex flex-col items-center p-4">
      <h1 className="text-4xl font-bold mb-6 text-center">
        🤖 AI-Powered Interview Assistant
      </h1>

      <div role="tablist" className="tabs tabs-lifted tabs-lg mb-6">
        <button
          role="tab"
          className={`tab ${activeTab === "interviewee" ? "tab-active" : ""}`}
          onClick={() => setActiveTab("interviewee")}
        >
          Interviewee
        </button>
        <button
          role="tab"
          className={`tab ${activeTab === "interviewer" ? "tab-active" : ""}`}
          onClick={() => setActiveTab("interviewer")}
        >
          Interviewer
        </button>
      </div>

      <div className="w-full max-w-5xl">
        {activeTab === "interviewee" ? (
          <IntervieweeView />
        ) : (
          <InterviewerDashboard />
        )}
      </div>
    </div>
  );
}
