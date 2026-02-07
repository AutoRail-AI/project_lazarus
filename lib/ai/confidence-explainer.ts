import { getGeminiClient } from "./gemini"
import { confidenceExplanationSchema } from "./schemas"

export interface TestResults {
  unit: { passed: number; total: number }
  e2e: { passed: number; total: number }
  visual: { matchPercentage: number } // 0-100
  behavioral: { matchPercentage: number } // 0-100
  video: { similarity: number } // 0-1
}

export function calculateConfidence(results: TestResults): number {
  const unitRate = results.unit.total > 0 ? results.unit.passed / results.unit.total : 0
  const e2eRate = results.e2e.total > 0 ? results.e2e.passed / results.e2e.total : 0
  const visualRate = results.visual.matchPercentage / 100
  const behavioralRate = results.behavioral.matchPercentage / 100
  const videoRate = results.video.similarity

  // Weights
  const wUnit = 0.15
  const wE2e = 0.25
  const wVisual = 0.20
  const wBehavioral = 0.20
  const wVideo = 0.20

  const confidence = 
    (unitRate * wUnit) +
    (e2eRate * wE2e) +
    (visualRate * wVisual) +
    (behavioralRate * wBehavioral) +
    (videoRate * wVideo)

  return Math.min(Math.max(confidence, 0), 1)
}

export async function explainConfidence(
  results: TestResults,
  currentConfidence: number
): Promise<string> {
  const client = getGeminiClient()

  const prompt = `
    You are a QA analyst. Analyze these test results and the current confidence score (${(currentConfidence * 100).toFixed(1)}%).
    
    Results:
    - Unit Tests: ${results.unit.passed}/${results.unit.total}
    - E2E Tests: ${results.e2e.passed}/${results.e2e.total}
    - Visual Match: ${results.visual.matchPercentage}%
    - Behavioral Match: ${results.behavioral.matchPercentage}%
    - Video Similarity: ${(results.video.similarity * 100).toFixed(1)}%
    
    Provide a 2-3 sentence explanation of the score. Highlight what is working well and what is dragging the score down. Be specific but concise.
  `

  try {
    const result = await client.generateStructured(
      prompt,
      confidenceExplanationSchema
    )
    return result.explanation
  } catch (error) {
    console.error("Failed to explain confidence:", error)
    return "Confidence score based on aggregated test metrics."
  }
}
