import { createSlice } from "@reduxjs/toolkit";

// -------------------
// Helpers
// -------------------
const generateId = (prefix = "id") =>
  `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

const createEmptyInterview = () => ({
  candidateInfo: { name: "", email: "", phone: "" },
  questions: [], // { id, text, difficulty, subject?, createdAt, answer?, score?, feedback? }
  answers: [],
  currentQuestionIndex: 0,
  finalScore: null,
  status: "not_started", // not_started | collecting_info | in_progress | completed
});

const initialStateTemplate = {
  interviews: [],
  currentInterview: createEmptyInterview(),
  lastActiveSession: null,
};

// -------------------
// Persistence
// -------------------
const STORAGE_KEY = "interviewState_v1";

const saveStateToStorage = (state) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (err) {
    console.error("Failed to save interview state:", err);
  }
};

const loadStateFromStorage = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return initialStateTemplate;
    const parsed = JSON.parse(raw);

    return {
      interviews: Array.isArray(parsed.interviews) ? parsed.interviews : [],
      currentInterview: {
        ...createEmptyInterview(),
        ...(parsed.currentInterview || {}),
        candidateInfo: {
          ...createEmptyInterview().candidateInfo,
          ...(parsed.currentInterview?.candidateInfo || {}),
        },
        questions: Array.isArray(parsed.currentInterview?.questions)
          ? parsed.currentInterview.questions
          : [],
        answers: Array.isArray(parsed.currentInterview?.answers)
          ? parsed.currentInterview.answers
          : [],
        currentQuestionIndex:
          typeof parsed.currentInterview?.currentQuestionIndex === "number"
            ? parsed.currentInterview.currentQuestionIndex
            : 0,
      },
      lastActiveSession: parsed.lastActiveSession || null,
    };
  } catch (err) {
    console.error("Failed to load interview state, using defaults:", err);
    return initialStateTemplate;
  }
};

const validateStatus = (s) =>
  ["not_started", "collecting_info", "in_progress", "completed"].includes(s);

// -------------------
// Slice
// -------------------
const interviewSlice = createSlice({
  name: "interview",
  initialState: loadStateFromStorage(),
  reducers: {
    // ✅ Candidate Info
    setCandidateInfo(state, action) {
      state.currentInterview.candidateInfo = {
        ...state.currentInterview.candidateInfo,
        ...action.payload,
      };

      if (state.currentInterview.status === "not_started") {
        state.currentInterview.status = "collecting_info";
      }
      saveStateToStorage(state);
    },

    updateCandidateInfo(state, action) {
      state.currentInterview.candidateInfo = {
        ...state.currentInterview.candidateInfo,
        ...action.payload,
      };
      saveStateToStorage(state);
    },

    // ✅ Questions
    setQuestions(state, action) {
      const qList = Array.isArray(action.payload) ? action.payload : [];
      state.currentInterview.questions = qList.map((q) => ({
        id: q.id || generateId("q"),
        text: q.text || "",
        difficulty: q.difficulty || null,
        subject: q.subject || null,
        createdAt: q.createdAt || new Date().toISOString(),
        answer: q.answer ?? null,
        score: typeof q.score === "number" ? q.score : null,
        feedback: q.feedback ?? null,
      }));
      state.currentInterview.answers = state.currentInterview.questions.map(
        (q) => q.answer ?? null
      );
      saveStateToStorage(state);
    },

    addQuestion(state, action) {
      const payload = action.payload || {};
      const question = {
        id: payload.id || generateId("q"),
        text: payload.text || "",
        difficulty: payload.difficulty || null,
        subject: payload.subject || null,
        createdAt: payload.createdAt || new Date().toISOString(),
      };
      state.currentInterview.questions.push(question);

      if (
        state.currentInterview.answers.length <
        state.currentInterview.questions.length
      ) {
        state.currentInterview.answers.push(null);
      }

      if (state.currentInterview.status === "not_started") {
        state.currentInterview.status = "in_progress";
      }

      saveStateToStorage(state);
    },

    addAnswer(state, action) {
      const payload = action.payload;
      let ansObj = {};

      if (typeof payload === "string") {
        ansObj = {
          answer: payload,
          index: state.currentInterview.currentQuestionIndex,
        };
      } else if (payload && typeof payload === "object") {
        ansObj = { ...payload };
      } else return;

      let targetIndex =
        typeof ansObj.index === "number"
          ? ansObj.index
          : state.currentInterview.currentQuestionIndex;

      if (ansObj.questionId) {
        const qIdx = state.currentInterview.questions.findIndex(
          (q) => q.id === ansObj.questionId
        );
        if (qIdx >= 0) targetIndex = qIdx;
      }

      while (state.currentInterview.answers.length <= targetIndex) {
        state.currentInterview.answers.push(null);
      }

      state.currentInterview.answers[targetIndex] =
        ansObj.answer ?? "(No answer provided)";

      const targetQuestion = state.currentInterview.questions[targetIndex];
      if (targetQuestion) {
        state.currentInterview.questions[targetIndex] = {
          ...targetQuestion,
          answer:
            ansObj.answer ?? targetQuestion.answer ?? "(No answer provided)",
          score:
            typeof ansObj.score === "number"
              ? ansObj.score
              : targetQuestion.score ?? null,
          feedback:
            typeof ansObj.feedback === "string"
              ? ansObj.feedback
              : targetQuestion.feedback ?? null,
        };
      }

      saveStateToStorage(state);
    },

    submitAnswer(state, action) {
      const { questionId, answer, score, feedback } = action.payload || {};
      const qIdx = state.currentInterview.questions.findIndex(
        (q) => q.id === questionId
      );
      if (qIdx >= 0) {
        const q = state.currentInterview.questions[qIdx];
        state.currentInterview.questions[qIdx] = {
          ...q,
          answer: answer ?? q.answer ?? "(No answer provided)",
          score: typeof score === "number" ? score : q.score ?? null,
          feedback:
            typeof feedback === "string" ? feedback : q.feedback ?? null,
        };
        while (state.currentInterview.answers.length <= qIdx) {
          state.currentInterview.answers.push(null);
        }
        state.currentInterview.answers[qIdx] = answer ?? "(No answer provided)";
        state.currentInterview.currentQuestionIndex = Math.max(
          0,
          state.currentInterview.currentQuestionIndex + 1
        );
      }
      saveStateToStorage(state);
    },

    // ✅ Navigation
    nextQuestion(state, action) {
      const totalQuestions = action?.payload?.totalQuestions;
      const nextIndex = state.currentInterview.currentQuestionIndex + 1;

      if (typeof totalQuestions === "number") {
        if (nextIndex >= totalQuestions) {
          state.currentInterview.currentQuestionIndex = Math.max(
            0,
            totalQuestions - 1
          );
          state.currentInterview.status = "completed";
        } else {
          state.currentInterview.currentQuestionIndex = nextIndex;
        }
      } else {
        const maxIndex = Math.max(
          0,
          state.currentInterview.questions.length - 1
        );
        state.currentInterview.currentQuestionIndex = Math.min(
          nextIndex,
          maxIndex
        );
      }

      saveStateToStorage(state);
    },

    setCurrentQuestionIndex(state, action) {
      const idx = Number(action.payload);
      if (Number.isFinite(idx) && idx >= 0) {
        const maxIndex = Math.max(
          0,
          state.currentInterview.questions.length - 1
        );
        state.currentInterview.currentQuestionIndex = Math.min(idx, maxIndex);
        saveStateToStorage(state);
      }
    },

    setFinalScore(state, action) {
      const score = action.payload;
      state.currentInterview.finalScore =
        typeof score === "number" ? score : parseInt(score, 10) || null;
      saveStateToStorage(state);
    },

    setInterviewStatus(state, action) {
      const s = action.payload;
      if (validateStatus(s)) {
        state.currentInterview.status = s;
        if (s === "completed") state.lastActiveSession = null;
        saveStateToStorage(state);
      }
    },

    // ✅ Session & Archive
    archiveInterview(state, action) {
      const archived = JSON.parse(JSON.stringify(state.currentInterview));
      archived.date = new Date().toISOString();
      archived.status = "completed";

      if (action?.payload?.summary) archived.summary = action.payload.summary;

      state.interviews.push(archived);
      state.currentInterview = createEmptyInterview();
      state.lastActiveSession = null;
      saveStateToStorage(state);
    },

    resetInterview(state) {
      state.currentInterview = createEmptyInterview();
      saveStateToStorage(state);
    },

    restartInterviewKeepCandidate(state, action) {
      const keptInfo =
        action.payload ||
        state.currentInterview?.candidateInfo ||
        createEmptyInterview().candidateInfo;

      state.currentInterview = {
        ...createEmptyInterview(),
        candidateInfo: { ...keptInfo },
        status: "in_progress",
      };

      state.lastActiveSession = null;
      saveStateToStorage(state);
    },

    saveSession(state) {
      state.lastActiveSession = {
        candidateInfo: state.currentInterview.candidateInfo,
        questions: state.currentInterview.questions,
        answers: state.currentInterview.answers,
        currentQuestionIndex: state.currentInterview.currentQuestionIndex,
        status: state.currentInterview.status,
        timestamp: new Date().toISOString(),
      };
      saveStateToStorage(state);
    },

    resumeSession(state) {
      if (state.lastActiveSession) {
        state.currentInterview = {
          ...createEmptyInterview(),
          ...state.lastActiveSession,
          status: state.lastActiveSession.status || "in_progress",
        };
        state.lastActiveSession = null;
        saveStateToStorage(state);
      }
    },

    clearSession(state) {
      state.lastActiveSession = null;
      state.currentInterview = createEmptyInterview();
      saveStateToStorage(state);
    },
  },
});

export const {
  setCandidateInfo,
  updateCandidateInfo,
  addQuestion,
  addAnswer,
  submitAnswer,
  nextQuestion,
  setCurrentQuestionIndex,
  setFinalScore,
  setInterviewStatus,
  archiveInterview,
  resetInterview,
  restartInterviewKeepCandidate,
  setQuestions,
  saveSession,
  resumeSession,
  clearSession,
} = interviewSlice.actions;

export default interviewSlice.reducer;
