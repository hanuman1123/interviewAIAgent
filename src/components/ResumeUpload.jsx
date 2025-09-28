import React, { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  setCandidateInfo,
  setInterviewStatus,
  clearSession,
  resumeSession,
} from "../features/interview/interviewSlice";
import * as pdfjsLib from "pdfjs-dist";
import pdfjsWorker from "pdfjs-dist/build/pdf.worker.min?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

export default function ResumeUpload() {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [showResumeOptions, setShowResumeOptions] = useState(false);
  const [extractedInfo, setExtractedInfo] = useState(null);
  const [showWelcomeBack, setShowWelcomeBack] = useState(false);

  const dispatch = useDispatch();
  const lastActiveSession = useSelector((state) => state.interview.lastActiveSession);

  // NOTE: we intentionally do NOT auto-show resume options on mount.
  // The app will route the user to the ResumeUpload page when a saved
  // session exists (handled in IntervieweeView). We only display the
  // Resume / Start New options after the user uploads a resume and the
  // extracted details match the saved session (see `checkForExistingSession`).

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile && selectedFile.type === "application/pdf") {
      setFile(selectedFile);
      setError("");
    } else {
      setFile(null);
      setError("Please select a valid PDF file.");
    }
  };

  const checkForExistingSession = (info) => {
    if (
      lastActiveSession &&
      lastActiveSession.candidateInfo.email === info.email &&
      lastActiveSession.candidateInfo.phone === info.phone
    ) {
      setShowResumeOptions(true);
      setExtractedInfo(info);
      // If name also matches, show a personalized welcome back message
      if ((lastActiveSession.candidateInfo.name || "").toLowerCase() === (info.name || "").toLowerCase()) {
        setShowWelcomeBack(true);
      } else {
        setShowWelcomeBack(false);
      }
      return true;
    }
    return false;
  };

  const handleRestartExam = () => {
    // Clear any saved session and return user to the upload form so they can
    // start from scratch. We do NOT prefill candidate info here.
    dispatch(clearSession());
    setExtractedInfo(null);
    setShowWelcomeBack(false);
    setShowResumeOptions(false);
  };

  const handleResumeExam = () => {
    dispatch(resumeSession());
    setShowResumeOptions(false);
  };

  const handleUpload = async () => {
    if (!file) {
      setError("Please select a file first.");
      return;
    }

    setUploading(true);
    setError("");

    const reader = new FileReader();
    reader.readAsArrayBuffer(file);

    reader.onload = async (event) => {
      try {
        const pdf = await pdfjsLib.getDocument(event.target.result).promise;
        let fullText = "";

        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          fullText += textContent.items.map((s) => s.str).join(" ");
        }

        // Regex for extraction
        const emailRegex = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/gi;
        const phoneRegex = /(\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4})/g;

        const email = fullText.match(emailRegex)?.[0] || "";
        const phone = fullText.match(phoneRegex)?.[0] || "";

        // Simple heuristic for name: pick the first non-empty line that doesn't
        // contain an email or phone and is of reasonable length. If we can't
        // reliably detect a name, leave it empty so the InfoCollector will ask for it.
        const lines = fullText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
        let name = lines.find((line) => !emailRegex.test(line) && !phoneRegex.test(line) && line.length < 50) || "";

        // Clean extracted values
        const cleanedEmail = (email || "").trim();
        const cleanedPhone = (phone || "").trim();

        // Normalize phone for storage/comparison by removing non-digits
        const normalizedPhone = cleanedPhone.replace(/\D+/g, "");

        // If the name looks like an email or phone, blank it so the bot will ask
        if (!name || emailRegex.test(name) || phoneRegex.test(name)) {
          name = "";
        }

        const info = { name, email: cleanedEmail, phone: normalizedPhone };

        const hasExistingSession = checkForExistingSession(info);

        if (!hasExistingSession) {
          dispatch(setCandidateInfo(info));
          dispatch(setInterviewStatus("collecting_info"));
        }
      } catch (err) {
        setError("Failed to parse the PDF. Please try another file.");
        console.error(err);
      } finally {
        setUploading(false);
      }
    };
  };

  return (
    <div className="text-center">
      <h3 className="text-xl font-semibold mb-4">Upload Your Resume to Begin</h3>
      <p className="mb-4 text-base-content/70">Please upload your resume in PDF format.</p>

      {showResumeOptions ? (
        <div className="space-y-4">
          {showWelcomeBack ? (
            <p className="text-lg">Welcome back, {extractedInfo?.name || 'Candidate'}! We found your previous session.</p>
          ) : (
            <p className="text-lg">Welcome back! We found your previous session.</p>
          )}
          <div className="flex justify-center gap-4">
            <button onClick={handleResumeExam} className="btn btn-primary">
              Resume Exam
            </button>
            <button onClick={handleRestartExam} className="btn btn-secondary">
              Start New Exam
            </button>
          </div>
        </div>
      ) : (
        <div className="form-control w-full max-w-xs mx-auto">
          <input
            type="file"
            onChange={handleFileChange}
            accept=".pdf"
            className="file-input file-input-bordered w-full"
          />
          <button
            onClick={handleUpload}
            disabled={!file || uploading}
            className="btn btn-primary mt-4"
          >
            {uploading ? <span className="loading loading-spinner"></span> : "Upload and Start"}
          </button>
        </div>
      )}

      {error && <p className="text-error mt-4">{error}</p>}
    </div>
  );
}
