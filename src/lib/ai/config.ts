/** Vision-heavy grading: prefer gpt-4o via OPENAI_GRADING_MODEL for best rubric fidelity. */
export const DEFAULT_AI_GRADING_MODEL = "gpt-4o";

/** Rubric generation uses Gemini for superior PDF/formula understanding. */
export const DEFAULT_GEMINI_RUBRIC_MODEL = "gemini-2.0-flash";

/** Some models reject the temperature parameter entirely (o-series reasoning, gpt-5 family). */
export function modelSupportsTemperature(model: string): boolean {
  if (/^o[0-9]/.test(model)) return false;
  if (/^gpt-5/.test(model)) return false;
  return true;
}

export function getAiGradingModel() {
  return process.env.OPENAI_GRADING_MODEL?.trim() || DEFAULT_AI_GRADING_MODEL;
}

export function getOpenAiApiKey() {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) {
    throw new Error("Missing OPENAI_API_KEY");
  }
  return key;
}

export function getGeminiApiKey() {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) {
    throw new Error("Missing GEMINI_API_KEY");
  }
  return key;
}

export function getGeminiRubricModel() {
  return process.env.GEMINI_GRADING_MODEL?.trim() || DEFAULT_GEMINI_RUBRIC_MODEL;
}

