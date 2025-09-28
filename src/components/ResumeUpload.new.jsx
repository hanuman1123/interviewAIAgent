import React, { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  setCandidateInfo,
  setInterviewStatus,
  resumeSession,
  restartInterviewKeepCandidate,
} from "../features/interview/interviewSlice";

import * as pdfjsLib from "pdfjs-dist";
import pdfjsWorker from "pdfjs-dist/build/pdf.worker.min?url";
import Tesseract from "tesseract.js";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

export default function ResumeUpload() {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [showResumeOptions, setShowResumeOptions] = useState(false);
  const [extractedInfo, setExtractedInfo] = useState(null);
  const [showWelcomeBack, setShowWelcomeBack] = useState(false);

  const dispatch = useDispatch();
  const lastActiveSession = useSelector(
    (state) => state.interview.lastActiveSession
  );

  // Handle File Selection
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

  // Check for Existing Session
  const checkForExistingSession = (info) => {
    if (
      lastActiveSession &&
      (lastActiveSession.candidateInfo.email || "").trim().toLowerCase() ===
        (info.email || "").trim().toLowerCase() &&
      (lastActiveSession.candidateInfo.phone || "").replace(/\D+/g, "") ===
        (info.phone || "").replace(/\D+/g, "")
    ) {
      setShowResumeOptions(true);
      setExtractedInfo(info);
      setShowWelcomeBack(true); // ✅ Correctly show welcome back
      return true;
    }

    // Reset welcome back if no match
    setShowWelcomeBack(false);
    return false;
  };

  // Restart Exam
  const handleRestartExam = () => {
    dispatch(restartInterviewKeepCandidate(extractedInfo));
    setShowResumeOptions(false);
  };

  // Resume Exam
  const handleResumeExam = () => {
    dispatch(resumeSession());
    setShowResumeOptions(false);
  };

  // PDF Text Extraction
  const extractTextFromPDF = async (arrayBuffer) => {
    try {
      const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
      let fullText = "";
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        if (textContent.items.length > 0) {
          fullText += textContent.items.map((s) => s.str).join("\n") + "\n";
        }
      }
      return fullText.trim();
    } catch (err) {
      console.error("PDF text extraction failed:", err);
      return "";
    }
  };

  // OCR Fallback
  const performOCR = async (arrayBuffer) => {
    try {
      const blob = new Blob([arrayBuffer], { type: "application/pdf" });
      const images = await PDFJSConvertToImages(blob);
      let ocrText = "";
      for (let i = 0; i < images.length; i++) {
        const { data } = await Tesseract.recognize(
          images[i],
          "eng",
          { logger: () => {} }
        );
        ocrText += data.text + "\n";
      }
      return ocrText.trim();
    } catch (err) {
      console.error("OCR failed:", err);
      return "";
    }
  };

  const PDFJSConvertToImages = async (blob) => {
    const pdf = await pdfjsLib.getDocument(await blob.arrayBuffer()).promise;
    const images = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const viewport = page.getViewport({ scale: 2 });
      const canvas = document.createElement("canvas");
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext("2d");
      await page.render({ canvasContext: ctx, viewport }).promise;
      images.push(canvas.toDataURL("image/png"));
    }
    return images;
  };

  // Handle Upload
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
        let fullText = await extractTextFromPDF(event.target.result);

        if (!fullText || fullText.length < 5) {
          fullText = await performOCR(event.target.result);
        }

        const emailRegex =
          /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/;
        const phoneRegex =
          /(\+?\d{1,4}[-.\s]?)?(\(?\d{2,4}\)?[-.\s]?)?\d{6,14}/;

        const email = fullText.match(emailRegex)?.[0] || "";
        const phone = fullText.match(phoneRegex)?.[0] || "";

        const lines = fullText
          .split(/\r?\n/)
          .map((l) => l.trim())
          .filter(Boolean);

        let name =
          lines.find(
            (line) =>
              !emailRegex.test(line) &&
              !phoneRegex.test(line) &&
              line.length < 50
          ) || "";

        if (!name || emailRegex.test(name) || phoneRegex.test(name)) name = "";

        const info = {
          name: name.trim(),
          email: email.trim(),
          phone: phone.replace(/\D+/g, ""),
        };

        const hasExistingSession = checkForExistingSession(info);

        if (!hasExistingSession) {
          dispatch(setCandidateInfo(info));
          dispatch(setInterviewStatus("collecting_info"));
        }
      } catch (err) {
        console.error(err);
        setError("Failed to parse the PDF. Please try another file.");
      } finally {
        setUploading(false);
      }
    };
  };

  return (
    <div className="text-center">
      <h3 className="text-xl font-semibold mb-4">
        Upload Your Resume to Begin
      </h3>
      <p className="mb-4 text-base-content/70">
        Please upload your resume in PDF format.
      </p>

      {showResumeOptions ? (
        <div className="space-y-4">
          {showWelcomeBack && (
            <p className="text-lg font-semibold text-green-600 chatbox">
              👋 Welcome back, {extractedInfo?.name || "Candidate"}!
            </p>
          )}
          <button
            onClick={handleRestartExam}
            className="btn btn-primary"
          >
            Start Interview
          </button>
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
            {uploading ? (
              <span className="loading loading-spinner"></span>
            ) : (
              "Upload and Start"
            )}
          </button>
        </div>
      )}

      {error && <p className="text-error mt-4">{error}</p>}
    </div>
  );
}
