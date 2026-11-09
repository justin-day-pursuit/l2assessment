import Groq from 'groq-sdk';
import { selectReasoningModelWithMostTokens } from './modelSelection.js';

/**
 * LLM Helper for categorizing customer support messages.
 * 
 * This module connects to the Groq API to classify support messages into one of four
 * standard categories:
 * - Billing Issue
 * - Feature Request
 * - Technical Problem
 * - General Inquiry
 * 
 * If the Groq API is unavailable, rate-limited, or offline, it falls back to a deterministic
 * keyword-based categorization function to guarantee uninterrupted application availability.
 */

// Initialize Groq client with browser allowance for local development
const groq = new Groq({
  apiKey: import.meta.env.VITE_GROQ_API_KEY,
  dangerouslyAllowBrowser: true // Required for client-side API execution
});

let cachedModelId = null;

/**
 * Determines which Groq reasoning model to invoke based on available tokens.
 * Caches the resolved model ID to avoid repeated listing calls.
 */
async function resolveCategorizationModel() {
  if (cachedModelId) return cachedModelId;

  const listing = await groq.models.list();
  const selected = selectReasoningModelWithMostTokens(listing.data);
  if (!selected) {
    throw new Error('No reasoning model is available for this Groq API key');
  }

  cachedModelId = selected.id;
  console.info(`Using Groq model ${cachedModelId}`);
  return cachedModelId;
}

// System prompt defining strict category boundaries and disambiguation rules
const SYSTEM_PROMPT = `You are an expert customer support ticket classifier for Relay AI.
Analyze the customer's intent and classify the message into EXACTLY ONE of the following 4 categories:

1. "Billing Issue"
   - Payment failures, invoice discrepancies, double charges, refunds, subscription upgrades/downgrades/cancellations, credit card updates, or billing portal access.

2. "Feature Request"
   - Suggestions for new functionality, enhancements, UI/UX requests (e.g. dark mode, CSV export, integrations), or requests to add capabilities not currently present.
   - Disambiguation: Even if the customer calls their need an "issue" or "problem" (e.g. "I have an issue with the lack of dark mode"), if they are asking for something new to be built or added, classify as "Feature Request".

3. "Technical Problem"
   - System outages, bugs, error codes (e.g. 500, 404, timeouts), crashes, performance degradation, broken workflows, or malfunctioning existing features.
   - Disambiguation: Only classify as "Technical Problem" when an existing system or feature is failing, broken, or not working as expected.

4. "General Inquiry"
   - General questions, how-to inquiries, business hours, documentation links, contact requests, or positive feedback/compliments.

Respond in this exact JSON format:
{
  "category": "Billing Issue" | "Feature Request" | "Technical Problem" | "General Inquiry",
  "reasoning": "Brief 1-2 sentence explanation of why this category was chosen."
}`;

const KNOWN_CATEGORIES = ['Billing Issue', 'Feature Request', 'Technical Problem', 'General Inquiry'];

/**
 * Categorizes a customer support message using Groq AI with structured JSON mode.
 * 
 * @param {string} message - The customer support message text.
 * @param {(status: {phase: string, source: string|null, model: string|null, error: string|null}) => void} [onStatus] - Callback to report status.
 * @returns {Promise<{category: string, reasoning: string, api: {source: string, model: string|null, error: string|null}}>}
 */
export async function categorizeMessage(message, onStatus = () => {}) {
  let model = null;

  try {
    if (!cachedModelId) {
      onStatus({ phase: 'listing', source: null, model: null, error: null });
    }

    model = await resolveCategorizationModel();
    onStatus({ phase: 'categorizing', source: null, model, error: null });

    const response = await groq.chat.completions.create({
      model,
      messages: [
        {
          role: "system",
          content: SYSTEM_PROMPT
        },
        {
          role: "user",
          content: `Classify this customer support message:\n"${message}"`
        }
      ],
      temperature: 0.1, // Low temperature for deterministic classification
      max_tokens: 350,
      response_format: { type: "json_object" }
    });

    const choice = response.choices[0].message;
    const rawContent = (choice.content || choice.reasoning || '').trim();
    
    let category = null;
    let reasoning = rawContent;

    // 1. Try parsing JSON output
    try {
      const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed.category && KNOWN_CATEGORIES.includes(parsed.category)) {
          category = parsed.category;
        }
        if (parsed.reasoning) {
          reasoning = parsed.reasoning;
        }
      }
    } catch {
      // JSON parse failed; fall back to text heuristics below
    }

    // 2. Fallback text parsing if JSON didn't return a known category
    if (!category) {
      const lines = rawContent.split('\n').map((l) => l.trim()).filter(Boolean);
      const firstLine = (lines[0] || '').replace(/^[^A-Za-z]+/, '');
      category = KNOWN_CATEGORIES.find((label) => firstLine.toLowerCase().startsWith(label.toLowerCase()));

      if (!category) {
        const lower = rawContent.toLowerCase();
        if (lower.includes('feature request') || lower.includes('enhancement')) {
          category = "Feature Request";
        } else if (lower.includes('billing issue') || lower.includes('payment') || lower.includes('invoice')) {
          category = "Billing Issue";
        } else if (lower.includes('technical problem') || lower.includes('bug') || lower.includes('outage')) {
          category = "Technical Problem";
        } else if (lower.includes('general inquiry') || lower.includes('inquiry')) {
          category = "General Inquiry";
        }
      }
    }

    if (!category) {
      category = "Unknown";
    }

    const api = { source: 'groq', model, error: null };
    onStatus({ phase: 'success', ...api });

    return {
      category,
      reasoning,
      api
    };
  } catch (error) {
    console.warn('Groq API failed, using mock response:', error.message);
    const fallback = getMockCategorization(message);
    const api = { source: 'fallback', model, error: error.message };
    onStatus({ phase: 'fallback', ...api });
    return { ...fallback, api };
  }
}

/**
 * Offline rule-based mock categorization when Groq API is unavailable.
 * Order of evaluation is prioritized so specific intents (feature requests, positive praise, billing)
 * are checked before generic problem words to prevent over-indexing on Technical Problem.
 * 
 * @param {string} message - Customer message text.
 * @returns {{category: string, reasoning: string}}
 */
function getMockCategorization(message) {
  const lower = message.toLowerCase();
  
  // Library of realistic explanation templates per category
  const reasoningVariations = {
    billing: [
      "Based on keywords related to payments, charges, or subscriptions, this inquiry relates to billing and account management.",
      "The customer is referencing financial matters, invoices, or payment methods requiring billing department review."
    ],
    technical: [
      "This message describes system errors, crashes, or broken functionality that requires engineering support.",
      "The customer is reporting functionality problems or outages indicating a technical malfunction."
    ],
    feature: [
      "The customer is suggesting improvements or requesting new capabilities not currently available.",
      "Based on the request for new options or enhancements, this is categorized as a feature request for product review."
    ],
    inquiry: [
      "This appears to be a general informational inquiry or how-to question regarding service capabilities.",
      "The message contains general questions or routine feedback requiring informational support."
    ],
    positive: [
      "The customer is expressing appreciation and positive feedback regarding the service.",
      "This message contains positive customer sentiment and does not report an operational issue."
    ],
    ambiguous: [
      "The message content does not match clear triage triggers and requires manual agent review."
    ]
  };
  
  const getRandomReasoning = (type) => {
    const list = reasoningVariations[type];
    return list[Math.floor(Math.random() * list.length)];
  };

  // 1. Positive Feedback Check
  // Check for genuine thank-you and praise first (if no negative 'but' / 'however')
  if ((lower.includes('thank') || lower.includes('thanks') || lower.includes('appreciate') || lower.includes('kudos')) &&
      !lower.includes('but') && !lower.includes('however') && !lower.includes('failed') && !lower.includes('broken')) {
    return {
      category: "General Inquiry",
      reasoning: getRandomReasoning('positive')
    };
  }

  // 2. Feature Request Check
  // Evaluated BEFORE technical problem so requests like "add dark mode" don't match technical problem
  if (lower.includes('feature') ||
      lower.includes('could you add') ||
      lower.includes('can you add') ||
      lower.includes('would love to see') ||
      lower.includes('would be great') ||
      lower.includes('dark mode') ||
      lower.includes('export to csv') ||
      lower.includes('integration') ||
      (lower.includes('add') && (lower.includes('please') || lower.includes('option'))) ||
      lower.includes('suggestion') ||
      lower.includes('roadmap') ||
      lower.includes('enhancement')) {
    return {
      category: "Feature Request",
      reasoning: getRandomReasoning('feature')
    };
  }

  // 3. Billing Related Detection
  // Check for subscription, payment, invoice, refund, and cancellation terms
  if (lower.includes('bill') ||
      lower.includes('payment') ||
      lower.includes('charge') ||
      lower.includes('invoice') ||
      lower.includes('credit card') ||
      lower.includes('subscription') ||
      lower.includes('refund') ||
      lower.includes('pricing') ||
      lower.includes('upgrade to') ||
      lower.includes('downgrade') ||
      (lower.includes('cancel') && (lower.includes('account') || lower.includes('subscription') || lower.includes('service') || lower.includes('plan')))) {
    return {
      category: "Billing Issue",
      reasoning: getRandomReasoning('billing')
    };
  }

  // 4. Technical Problem Detection
  // Specific malfunction and failure terms (generic word 'issue' removed to prevent over-indexing)
  if (lower.includes('bug') ||
      lower.includes('error') ||
      lower.includes('broken') ||
      lower.includes('not working') ||
      lower.includes('crash') ||
      lower.includes('server down') ||
      lower.includes('is down') ||
      lower.includes('timeout') ||
      lower.includes('500') ||
      lower.includes('cannot access') ||
      lower.includes("can't access") ||
      lower.includes('infinite loading') ||
      lower.includes('won\'t load') ||
      lower.includes('fails to') ||
      lower.includes('glitch') ||
      (lower.includes('problem') && !lower.includes('no problem'))) {
    return {
      category: "Technical Problem",
      reasoning: getRandomReasoning('technical')
    };
  }

  // 5. General Inquiry Check
  if (lower.includes('how to') ||
      lower.includes('how do i') ||
      lower.includes('what are your') ||
      lower.includes('when') ||
      lower.includes('where can i') ||
      lower.includes('documentation') ||
      lower.includes('hours') ||
      lower.includes('?')) {
    return {
      category: "General Inquiry",
      reasoning: getRandomReasoning('inquiry')
    };
  }

  // Default fallback
  return {
    category: "General Inquiry",
    reasoning: getRandomReasoning('ambiguous')
  };
}
