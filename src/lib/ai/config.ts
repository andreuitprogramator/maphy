/** Vision-heavy grading: prefer gpt-4o via OPENAI_GRADING_MODEL for best rubric fidelity. */
export const DEFAULT_AI_GRADING_MODEL = "gpt-4o";

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

