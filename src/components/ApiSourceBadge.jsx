function ApiSourceBadge({ api }) {
  if (api?.source === 'groq' && api.model) {
    return (
      <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full font-semibold">
        {api.model}
      </span>
    )
  }

  if (api?.source === 'fallback') {
    return (
      <span className="text-xs bg-amber-100 text-amber-900 px-2 py-1 rounded-full font-semibold">
        Keyword fallback
      </span>
    )
  }

  return null
}

export default ApiSourceBadge
