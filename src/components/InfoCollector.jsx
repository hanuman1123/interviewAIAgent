import React, { useState, useEffect, useRef, useMemo } from "react";
import { useSelector, useDispatch } from "react-redux";
import { updateCandidateInfo, setInterviewStatus } from "../features/interview/interviewSlice";
import MessageBubble from "./MessageBubble";

export default function InfoCollector() {
  const dispatch = useDispatch();
  const rawCandidateInfo = useSelector(
    (state) => state.interview.currentInterview?.candidateInfo
  );
  const candidateInfo = useMemo(() => rawCandidateInfo || {}, [rawCandidateInfo]);

  const [messages, setMessages] = useState([]);
  const [userInput, setUserInput] = useState("");
  const [askingFor, setAskingFor] = useState("name"); // Start with name
  const chatEndRef = useRef(null);

  // Scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Initialize chat messages depending on already known info
  useEffect(() => {
    if (messages.length === 0) {
      const initialMessages = [];

      // Determine first field to ask
      if (!candidateInfo?.name) {
        setAskingFor("name");
        initialMessages.push({
          sender: "bot",
          text: "Hello! I couldn't find your name in the resume. What is your full name?",
        });
      } else if (!candidateInfo?.email) {
        setAskingFor("email");
        initialMessages.push({
          sender: "bot",
          text: `Hello ${candidateInfo.name}! What's your email address?`,
        });
      } else if (!candidateInfo?.phone) {
        setAskingFor("phone");
        initialMessages.push({
          sender: "bot",
          text: `Thanks, ${candidateInfo.name}. Lastly, what is your phone number?`,
        });
      } else {
        // All info present, ready to start immediately
        setAskingFor("done");
        initialMessages.push({
          sender: "bot",
          text: "Perfect, I have all your details. Ready to start the interview?",
        });
      }

      setMessages(initialMessages);
    }
  }, [candidateInfo, messages.length]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!userInput.trim() || askingFor === "done") return;

    setMessages((prev) => [...prev, { sender: "user", text: userInput }]);

    const moveToNextField = () => {
      if (!candidateInfo?.name) {
        setAskingFor("name");
      } else if (!candidateInfo?.email) {
        setAskingFor("email");
      } else if (!candidateInfo?.phone) {
        setAskingFor("phone");
      } else {
        setAskingFor("done");
      }
    };

    if (askingFor === "name") {
      dispatch(updateCandidateInfo({ name: userInput }));
      moveToNextField();
      if (!candidateInfo?.email) {
        setMessages((prev) => [
          ...prev,
          { sender: "bot", text: `Thanks, ${userInput}. Now, what is your email address?` },
        ]);
      } else if (!candidateInfo?.phone) {
        setMessages((prev) => [
          ...prev,
          { sender: "bot", text: `Thanks, ${userInput}. Lastly, what is your phone number?` },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          { sender: "bot", text: "Perfect, I have all your details. Ready to start the interview." },
        ]);
      }
    }

    else if (askingFor === "email") {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(userInput)) {
        setMessages((prev) => [
          ...prev,
          { sender: "bot", text: "That doesn't look like a valid email. Please try again." },
        ]);
        setUserInput("");
        return;
      }
      dispatch(updateCandidateInfo({ email: userInput }));
      moveToNextField();
      if (!candidateInfo?.phone) {
        setMessages((prev) => [
          ...prev,
          { sender: "bot", text: "Great. Lastly, what is your phone number?" },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          { sender: "bot", text: "Perfect, I have all your details. Ready to start the interview." },
        ]);
      }
    }

    else if (askingFor === "phone") {
      if (!/^\+?(\d[\s-]?){9,14}\d$/.test(userInput)) {
        setMessages((prev) => [
          ...prev,
          { sender: "bot", text: "That doesn't look like a valid phone number. Please try again." },
        ]);
        setUserInput("");
        return;
      }
      dispatch(updateCandidateInfo({ phone: userInput }));
      setAskingFor("done");
      setMessages((prev) => [
        ...prev,
        { sender: "bot", text: "Perfect, I have all your details. We're ready to start the interview." },
      ]);
    }

    setUserInput("");
  };

  return (
    <div className="flex flex-col h-[60vh] max-w-2xl mx-auto border rounded-lg shadow-lg overflow-hidden">
      {/* Chat Window */}
      <div className="flex-grow p-4 overflow-y-auto bg-base-200">
        {messages.length === 0 && (
          <p className="text-center text-gray-500">Waiting for bot to ask questions...</p>
        )}
        {messages.map((msg, index) => (
          <MessageBubble key={index} message={msg} />
        ))}
        <div ref={chatEndRef} />
      </div>

      {/* Input Box */}
      {askingFor !== "done" && (
        <form
          onSubmit={handleSubmit}
          className="p-4 bg-base-100 border-t flex items-center gap-2"
        >
          <input
            type="text"
            className="input input-bordered flex-grow"
            placeholder="Type your answer..."
            value={userInput}
            onChange={(e) => setUserInput(e.target.value)}
            disabled={!askingFor || askingFor === "done"}
          />
          <button
            type="submit"
            className="btn btn-primary"
            disabled={!askingFor || askingFor === "done"}
          >
            Send
          </button>
        </form>
      )}

      {/* Start Interview Button */}
      {askingFor === "done" && (
        <div className="p-4 bg-base-100 border-t text-center">
          <button
            className="btn btn-success"
            onClick={() => dispatch(setInterviewStatus("in_progress"))}
          >
            Start Interview
          </button>
        </div>
      )}
    </div>
  );
}
