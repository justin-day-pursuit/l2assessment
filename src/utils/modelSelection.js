const EXCLUDED_ID = /safeguard|prompt-guard|whisper|orpheus/i

function numeric(value) {
  const number = Number(value)
  return Number.isFinite(number) ? number : 0
}

function availableTokens(model) {
  return Math.max(
    numeric(model?.context_window),
    numeric(model?.context_length),
    numeric(model?.max_completion_tokens),
    numeric(model?.max_output_length),
  )
}

function outputTokens(model) {
  return Math.max(
    numeric(model?.max_completion_tokens),
    numeric(model?.max_output_length),
  )
}

function isReasoningCandidate(model) {
  if (!model?.id || model.active === false) return false
  if (EXCLUDED_ID.test(model.id)) return false

  const outputs = model.output_modalities || []
  const inputs = model.input_modalities || []
  if (!outputs.includes('text') || !inputs.includes('text')) return false

  const features = model.supported_features || []
  return features.includes('reasoning')
}

/**
 * Choose a chat model from a Groq models.list payload.
 * The list is already limited to models this API key can call.
 * The reasoning model with the most available tokens wins.
 * Equal budgets prefer the larger completion limit.
 */
export function selectReasoningModelWithMostTokens(models) {
  const candidates = (models || []).filter(isReasoningCandidate)
  candidates.sort((a, b) => {
    const tokenDiff = availableTokens(b) - availableTokens(a)
    if (tokenDiff !== 0) return tokenDiff

    const outputDiff = outputTokens(b) - outputTokens(a)
    if (outputDiff !== 0) return outputDiff

    return a.id.localeCompare(b.id)
  })

  return candidates[0] || null
}
