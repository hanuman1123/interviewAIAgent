import { GoogleGenAI } from "@google/genai";

const googleai = new GoogleGenAI({
  apiKey: import.meta.env.VITE_GOOGLE_AI_API_KEY,
});

export class Assistant {
  #chat;
  #model;

  constructor(model = "gemini-2.0-flash") {
    this.#model = model;
    this.#chat = googleai.chats.create({ model });
  }

  createChat(history = []) {
    this.#chat = googleai.chats.create({
      model: this.#model,
      history: history
        .filter(({ role }) => role !== "system")
        .map(({ content, role }) => ({
          parts: [{ text: content }],
          role: role === "assistant" ? "model" : role,
        })),
    });
  }

  async chat(content) {
    const maxAttempts = 4;
    let attempt = 0;

    const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

    while (attempt < maxAttempts) {
      try {
        const result = await this.#chat.sendMessage({ message: content });
        // result shape may vary depending on SDK version; try common accessors
        const text = result?.text ?? (typeof result === "string" ? result : result?.response?.text ?? "");
        return String(text || "").trim();
      } catch (error) {
        attempt += 1;
        // try to extract a status code or status string from the error
        const statusCode = error?.response?.status || error?.status || error?.code || error?.error?.code;
        const statusStr = error?.error?.status || error?.statusText || error?.message;
        console.error(`Assistant chat attempt ${attempt} failed:`, statusCode ?? statusStr ?? error);

  // If we've exhausted attempts, break so we throw below
  if (attempt >= maxAttempts) break;

        // Retry for transient server errors (503) or UNAVAILABLE
        const transient = statusCode === 503 || String(statusStr).toUpperCase().includes("UNAVAILABLE");
        const network = !statusCode; // unknown status - could be network error
        if (!transient && !network) {
          // non-retryable error (bad request, auth, etc.)
          break;
        }

        // Exponential backoff with jitter
        const backoff = Math.min(2000 * Math.pow(2, attempt - 1), 8000);
        const jitter = Math.floor(Math.random() * 200);
        await sleep(backoff + jitter);
        // try again
      }
    }

    console.error("Assistant chat: service unavailable after retries.");
    // Throw so callers can decide how to fallback (local questions, retry UI, etc.)
    const err = new Error("AssistantServiceUnavailable");
    err.code = "ASSISTANT_UNAVAILABLE";
    throw err;
  }
}
