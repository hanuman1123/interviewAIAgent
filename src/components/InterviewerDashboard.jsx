import React, { useState, useMemo, useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";
import {
  clearSession,
  resumeSession,
  archiveInterview,
  restartInterviewKeepCandidate,
} from "../features/interview/interviewSlice";
import { useNavigate } from "react-router-dom";

export default function InterviewerDashboard() {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const interviews = useSelector((state) => state.interview.interviews || []);
  const lastSession = useSelector((state) => state.interview.lastActiveSession);

  const [query, setQuery] = useState("");
  const [filterBy, setFilterBy] = useState("name");
  const [viewCandidate, setViewCandidate] = useState(null);

  // Auto-save candidate info on interview change
  useEffect(() => {
    const latestInterview = interviews.find(
      (iv) => iv.status === "in_progress" || iv.status === "completed"
    );
    if (latestInterview?.candidateInfo) {
      localStorage.setItem(
        "savedCandidateInfo",
        JSON.stringify(latestInterview.candidateInfo)
      );
    }
  }, [interviews]);

  // Filter & sort
  const filtered = useMemo(() => {
    const q = String(query || "").trim().toLowerCase();
    let list = [...interviews];
    if (q) {
      list = list.filter((iv) => {
        const info = iv.candidateInfo || {};
        if (filterBy === "name")
          return (info.name || "").toLowerCase().includes(q);
        if (filterBy === "email")
          return (info.email || "").toLowerCase().includes(q);
        if (filterBy === "phone")
          return (info.phone || "").toLowerCase().includes(q);
        return (
          (info.name || "").toLowerCase().includes(q) ||
          (info.email || "").toLowerCase().includes(q) ||
          (info.phone || "").toLowerCase().includes(q)
        );
      });
    }
    return list.sort((a, b) => (b.finalScore ?? 0) - (a.finalScore ?? 0));
  }, [interviews, query, filterBy]);

  // DELETE interview session completely
  const handleDelete = (interviewId) => {
    dispatch(clearSession(interviewId));
    localStorage.removeItem("interviewState_v1");
    localStorage.removeItem("savedCandidateInfo");
    navigate("/resume-upload"); // redirect to ResumeUpload
  };

  // RESTART exam with saved candidate info
  const handleRestart = (interviewId) => {
    const savedCandidate = localStorage.getItem("savedCandidateInfo");
    if (savedCandidate) {
      const candidateInfo = JSON.parse(savedCandidate);
      dispatch(restartInterviewKeepCandidate({ interviewId, candidateInfo }));
      navigate("/exam"); // go directly to exam
    }
  };

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-4">📊 Interview Dashboard</h2>

      {/* Search */}
      <div className="mb-4 flex flex-wrap gap-2 items-center">
        <input
          type="text"
          placeholder={`Search by ${filterBy}...`}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="input input-bordered w-full max-w-sm"
        />
        <select
          value={filterBy}
          onChange={(e) => setFilterBy(e.target.value)}
          className="select select-bordered ml-2"
        >
          <option value="name">Name</option>
          <option value="email">Email</option>
          <option value="phone">Phone</option>
        </select>
        <button className="btn btn-ghost ml-2" onClick={() => setQuery("")}>
          Clear
        </button>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <p className="text-gray-500">No interviews match your search.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="table table-zebra w-full">
            <thead>
              <tr>
                <th>Date</th>
                <th>Candidate</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Score</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((iv, idx) => {
                const info = iv.candidateInfo || {};
                return (
                  <tr key={idx}>
                    <td>{iv.date ? new Date(iv.date).toLocaleString() : "N/A"}</td>
                    <td>{info.name || "N/A"}</td>
                    <td>{info.email || "N/A"}</td>
                    <td>{info.phone || "N/A"}</td>
                    <td>{iv.finalScore ?? "N/A"}</td>
                    <td>
                      <span
                        className={`badge ${
                          iv.status === "completed"
                            ? "badge-success"
                            : iv.status === "in_progress"
                            ? "badge-info"
                            : "badge-warning"
                        }`}
                      >
                        {iv.status || "N/A"}
                      </span>
                    </td>
                    <td className="flex gap-2">
                      <button
                        className="btn btn-xs btn-info"
                        onClick={() => setViewCandidate(iv)}
                      >
                        View
                      </button>
                      <button
                        className="btn btn-error btn-xs"
                        onClick={() => handleDelete(iv.id)}
                      >
                        Delete
                      </button>
                      <button
                        className="btn btn-success btn-xs"
                        onClick={() => dispatch(archiveInterview(iv.id))}
                      >
                        Archive
                      </button>
                      {iv.status === "completed" && (
                        <button
                          className="btn btn-warning btn-xs"
                          onClick={() => handleRestart(iv.id)}
                        >
                          Restart
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Candidate Modal */}
      {viewCandidate && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-50">
          <div className="bg-white p-6 rounded shadow-lg max-w-lg w-full overflow-y-auto max-h-[80vh]">
            <h3 className="text-xl font-semibold mb-4">
              {viewCandidate.candidateInfo?.name}
            </h3>
            <p>
              <strong>Email:</strong> {viewCandidate.candidateInfo?.email}
            </p>
            <p>
              <strong>Phone:</strong> {viewCandidate.candidateInfo?.phone}
            </p>
            <p>
              <strong>Status:</strong> {viewCandidate.status}
            </p>
            <p>
              <strong>Final Score:</strong> {viewCandidate.finalScore ?? "N/A"}
            </p>

            {viewCandidate.summary && (
              <div className="mt-4 p-4 border rounded bg-gray-50">
                <h4 className="font-semibold mb-2">🤖 AI Summary</h4>
                <p>{viewCandidate.summary}</p>
              </div>
            )}

            <div className="mt-4">
              <h4 className="font-semibold mb-2">Chat / Q&A History</h4>
              {viewCandidate.questions.length === 0 ? (
                <p className="text-gray-500">No questions answered yet.</p>
              ) : (
                <ul className="space-y-2">
                  {viewCandidate.questions.map((q, idx) => (
                    <li key={q.id} className="p-2 border rounded">
                      <p className="font-semibold">{q.text}</p>
                      <p>
                        <strong>Answer:</strong> {viewCandidate.answers[idx] ?? "N/A"}
                      </p>
                      {q.score !== null && (
                        <p>
                          <strong>Score:</strong> {q.score}
                        </p>
                      )}
                      {q.feedback && (
                        <p>
                          <strong>Feedback:</strong> {q.feedback}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="mt-4 text-right">
              <button
                className="btn btn-ghost"
                onClick={() => setViewCandidate(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
