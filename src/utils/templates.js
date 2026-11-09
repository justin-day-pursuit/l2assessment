/**
 * Recommendation Templates & Action Routing - Maps message categories and urgency
 * to operational next steps and escalation policies.
 * 
 * In the triage system, after AI classification and urgency scoring complete, this module
 * acts as the decision engine. It determines:
 * 1. The immediate recommended next step for support agents or automated auto-responders.
 * 2. Whether the ticket requires management/engineering escalation.
 */

// Granular action matrix mapping category and urgency to targeted operational workflows
const actionMatrix = {
  "Billing Issue": {
    High: "Route to billing operations immediately to unlock account and verify payment failure.",
    Medium: "Direct user to self-service billing portal and verify invoice history or payment status.",
    Low: "Provide receipt/invoice link and self-service subscription management FAQ."
  },
  "Technical Problem": {
    High: "Escalate immediately to on-call engineering / incident response team.",
    Medium: "Provide standard troubleshooting guide and request device/system details.",
    Low: "Suggest user to restart their browser and clear application cache."
  },
  "Feature Request": {
    High: "Acknowledge high-priority feedback with user and tag product lead for review.",
    Medium: "Log request in product feedback backlog and share roadmap update.",
    Low: "Log request in product feedback backlog and share roadmap update."
  },
  "General Inquiry": {
    High: "Fast-track response to senior customer success representative.",
    Medium: "Respond with relevant knowledge base FAQ link and offer follow-up assistance.",
    Low: "Respond with relevant knowledge base FAQ link and offer follow-up assistance."
  },
  "Unknown": {
    High: "Escalate to support team lead for immediate manual evaluation.",
    Medium: "Assign ticket to tier-1 agent for manual review and categorization.",
    Low: "Assign ticket to tier-1 agent for manual review and categorization."
  }
};

/**
 * Gets the recommended action for a customer support message based on its category
 * and calculated urgency level.
 * 
 * For example:
 * - A standard Technical Problem suggests troubleshooting steps.
 * - A High-urgency Technical Problem routes directly to on-call engineering.
 * - A Feature Request logs feedback to the product backlog (fixing the earlier billing portal bug).
 * - A High-urgency Billing Issue routes directly to billing operations to unlock accounts.
 * 
 * @param {string} category - The AI-classified message category.
 * @param {string} [urgency='Medium'] - The rule-based urgency level ('High', 'Medium', 'Low').
 * @returns {string} - Clear, actionable recommended next step.
 */
export function getRecommendedAction(category, urgency = 'Medium') {
  const categoryActions = actionMatrix[category] || actionMatrix["Unknown"];
  const action = categoryActions[urgency] || categoryActions["Medium"];
  return action || "Review manually and route to appropriate team.";
}

/**
 * Retrieves the list of standard support categories supported by the application.
 * 
 * @returns {string[]} - Array of valid category names.
 */
export function getAvailableCategories() {
  return Object.keys(actionMatrix).filter(cat => cat !== "Unknown");
}

// Critical keywords that mandate ticket escalation regardless of other attributes
const ESCALATION_TRIGGERS = [
  'server down',
  'down now',
  'outage',
  'database connection lost',
  'data loss',
  'security breach',
  'breach',
  'production down',
  'emergency',
  'legal action',
  'sue',
  'lawyer',
  'payment failed'
];

/**
 * Determines whether an incoming support ticket should be formally escalated
 * to management, tier-2 technical support, or security leads.
 * 
 * Logic:
 * 1. Critical operational phrases (outage, data loss, security breach, payment failed) trigger immediate escalation.
 * 2. High-urgency technical or billing tickets require escalation.
 * 3. Routine feature requests or general inquiries do not escalate unless critical triggers are present.
 * 
 * @param {string} category - The message category.
 * @param {string} urgency - The urgency level ('High', 'Medium', 'Low').
 * @param {string} message - The original customer support message.
 * @returns {boolean} - True if the ticket requires escalation, false otherwise.
 */
export function shouldEscalate(category, urgency, message = '') {
  if (!message || typeof message !== 'string') {
    return urgency === 'High';
  }

  const lower = message.toLowerCase();

  // 1. Automatic escalation for critical system threats or legal/security mentions
  if (ESCALATION_TRIGGERS.some(trigger => lower.includes(trigger))) {
    return true;
  }

  // 2. High urgency technical or billing tickets require escalation
  if (urgency === 'High' && (category === 'Technical Problem' || category === 'Billing Issue')) {
    return true;
  }

  // 3. High urgency tickets in general (except routine feature feedback)
  if (urgency === 'High' && category !== 'Feature Request') {
    return true;
  }

  // Standard or low urgency tickets follow normal triage workflow
  return false;
}
