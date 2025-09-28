import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useSelector, useDispatch } from "react-redux";
import {
  addQuestion,
  addAnswer,
  nextQuestion,
  setFinalScore,
  setInterviewStatus,
  archiveInterview,
} from "../features/interview/interviewSlice";
import { Assistant } from "../helpers/Assistant.js";

const QUESTION_SEQUENCE = [
  { difficulty: "Easy", subject: "React" },
  { difficulty: "Easy", subject: "Node" },
  { difficulty: "Medium", subject: "React" },
  { difficulty: "Medium", subject: "Node" },
  { difficulty: "Hard", subject: "React" },
  { difficulty: "Hard", subject: "Node" },
];

const TIMERS = { Easy: 20, Medium: 60, Hard: 120 };

export default function InterviewScreen() {
  const dispatch = useDispatch();
  const { currentQuestionIndex = 0, questions = [], answers = [], candidateInfo = {} } =
    useSelector((state) => state.interview.currentInterview || {});

  const [currentQuestion, setCurrentQuestion] = useState("");
  const [userAnswer, setUserAnswer] = useState("");
  const userAnswerRef = React.useRef("");
  const [timeLeft, setTimeLeft] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [submitted, setSubmitted] = useState(false);

  const { difficulty, subject } = QUESTION_SEQUENCE[currentQuestionIndex] || {};
  const assistant = useMemo(() => new Assistant(), []);
  const [aiUnavailable, setAiUnavailable] = useState(false);

  // Local fallback questions to use when AI is down
  const LOCAL_QUESTIONS = useMemo(
    () => [
      "Explain the virtual DOM and how React uses it to optimize rendering.",
      "How do you manage state in a React application? Describe at least two approaches.",
      "Describe the event loop in Node.js and how it handles asynchronous I/O.",
      "What is the purpose of middleware in Express.js? Give an example use case.",
      "Explain CORS and how you'd handle it in a Node/Express API.",
      "How do hooks like useEffect and useMemo help with performance in React?",
    ],
    []
  );
  const [localQuestionIndex, setLocalQuestionIndex] = useState(0);

  const fetchQuestion = useCallback(async () => {
    if (!difficulty || !subject) return;
    setIsLoading(true);
    try {
      const prompt = `Ask one ${difficulty} interview question about ${subject} for a full-stack React/Node.js developer. Return only the question text.`;
      const question = await assistant.chat(prompt);
      setCurrentQuestion(question);
      dispatch(addQuestion({ text: question, difficulty, subject }));
      setTimeLeft(TIMERS[difficulty]);
      setAiUnavailable(false);
    } catch (error) {
      console.error("Question generation error:", error);
      // If assistant threw ASSISTANT_UNAVAILABLE, flip flag and fallback
      if (error?.code === "ASSISTANT_UNAVAILABLE") {
        setAiUnavailable(true);
        // Use a local fallback question
        const fallback = LOCAL_QUESTIONS[localQuestionIndex % LOCAL_QUESTIONS.length];
        setCurrentQuestion(fallback);
        dispatch(addQuestion({ text: fallback, difficulty, subject }));
        setTimeLeft(TIMERS[difficulty]);
      } else {
        setCurrentQuestion("⚠️ Error generating question.");
      }
    } finally {
      setIsLoading(false);
    }
  }, [difficulty, subject, dispatch, assistant, LOCAL_QUESTIONS, localQuestionIndex]);

  const handleSubmit = useCallback(async () => {
    if (submitted) return;
    setSubmitted(true);

    const answer = userAnswerRef.current || "(No answer provided)";
    dispatch(addAnswer(answer));
    setUserAnswer("");
    userAnswerRef.current = "";

    if (currentQuestionIndex < QUESTION_SEQUENCE.length - 1) {
      dispatch(nextQuestion());
      // If AI is unavailable, advance local fallback index
      if (aiUnavailable) setLocalQuestionIndex((i) => i + 1);
      // Allow React to finish processing the dispatched state change
      // before we trigger more state updates from fetchQuestion.
      await new Promise((res) => setTimeout(res, 0));
      await fetchQuestion();
      setSubmitted(false);
    } else {
      setIsLoading(true);
      setCurrentQuestion("Evaluating your answers...");
      try {
        const transcript = questions.map((q, i) => ({
          question: q.text,
          answer: answers[i] || "(No answer provided)",
        }));
        // use the captured answer from the ref (answer variable) rather than the state
        transcript.push({ question: currentQuestion, answer: answer || "(No answer provided)" });

        const evalPrompt = `Evaluate this interview transcript and give a score out of 100. Only return the numeric score.\n\n${transcript
          .map((t, i) => `Q${i + 1}: ${t.question}\nA${i + 1}: ${t.answer}`)
          .join("\n\n")}`;

        const scoreText = await assistant.chat(evalPrompt);
        const score = parseInt(scoreText.match(/\d+/)?.[0] || "0", 10);

        dispatch(setFinalScore(score));
        dispatch(archiveInterview());
        dispatch(setInterviewStatus("completed"));
      } catch (error) {
        console.error("Evaluation failed:", error);
        // If evaluation fails because assistant is down, set a fallback final score
        if (error?.code === "ASSISTANT_UNAVAILABLE") {
          // assign a neutral fallback score (e.g., 50)
          dispatch(setFinalScore(50));
        }
        dispatch(setInterviewStatus("completed"));
      }
    }
  }, [
    currentQuestionIndex,
    currentQuestion,
    dispatch,
    questions,
    answers,
    fetchQuestion,
    submitted,
    assistant,
    aiUnavailable,
  ]);

  useEffect(() => {
    if (currentQuestionIndex === 0 && !currentQuestion && candidateInfo.name) {
      const id = setTimeout(() => {
        fetchQuestion();
      }, 0);
      return () => clearTimeout(id);
    }
  }, [currentQuestionIndex, currentQuestion, fetchQuestion, candidateInfo.name]);

  // Timer only runs when question changes
  useEffect(() => {
    if (!isLoading && currentQuestion) {
      setTimeLeft(TIMERS[difficulty]);
      const timerId = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(timerId);
            handleSubmit();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timerId);
    }
    // include currentQuestion and handleSubmit in deps because they're referenced
  }, [currentQuestionIndex, difficulty, isLoading, currentQuestion, handleSubmit]);

  if (!candidateInfo.name || !candidateInfo.email || !candidateInfo.phone) {
    return (
      <div className="p-6 text-center">
        <p className="text-lg">Please complete your profile information to start the interview.</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-4">
      {isLoading ? (
        <div className="flex flex-col items-center">
          <p className="text-2xl mb-4">{currentQuestion || `Generating ${difficulty} question...`}</p>
          <span className="loading loading-dots loading-lg"></span>
        </div>
      ) : (
        <div className="space-y-6">
          {aiUnavailable && (
            <div className="alert alert-warning shadow-lg">
              <div>
                <span>AI service is currently unavailable. Using local fallback questions.</span>
              </div>
            </div>
          )}
          <div className="text-left">
            <p className="text-sm font-semibold text-gray-500">
              Question {currentQuestionIndex + 1} / {QUESTION_SEQUENCE.length}
            </p>
            <p
              className={`text-lg font-bold ${
                difficulty === "Easy"
                  ? "text-green-500"
                  : difficulty === "Medium"
                  ? "text-yellow-500"
                  : "text-red-500"
              }`}
            >
              {difficulty} - {subject}
            </p>
          </div>

          <div className="min-h-[100px] p-4 bg-base-200 rounded-lg shadow">
            <p className="text-2xl">{currentQuestion}</p>
          </div>

          <div className="flex justify-center">
            <div
              className="radial-progress text-primary"
              style={{ "--value": (timeLeft / TIMERS[difficulty]) * 100 }}
              role="progressbar"
            >
              {timeLeft}s
            </div>
          </div>

          <textarea
            className="textarea textarea-bordered w-full max-w-lg"
            rows="4"
            placeholder="Type your answer here..."
            value={userAnswer}
            onChange={(e) => {
              setUserAnswer(e.target.value);
              userAnswerRef.current = e.target.value;
            }}
          />

          <button
            onClick={handleSubmit}
            className="btn btn-primary w-full max-w-xs mx-auto"
          >
            Submit Answer
          </button>
        </div>
      )}
    </div>
  );
}
