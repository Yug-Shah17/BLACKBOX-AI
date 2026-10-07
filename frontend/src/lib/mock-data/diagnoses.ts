import { Diagnosis } from "@/types/telemetry";

export const MOCK_DIAGNOSES: Record<string, Diagnosis> = {
  run_0142: {
    runId: "run_0142",
    predictedFailureStep: 5,
    confidence: 0.91,
    failureType: "wrong_tool",
    explanation:
      "The agent invoked 'weather_forecast_service' instead of a flight inventory search provider. The user's query unambiguously requested commercial airline seat pricing between Mumbai (BOM) and Bengaluru (BLR). Selecting a meteorological tool corrupted the state vector and caused downstream hallucination.",
    evidence: [
      "Semantic intent vector for 'cheapest flight' exhibits 0.12 cosine similarity to weather_forecast_service schema.",
      "Extracted entity graph contained Origin=BOM, Destination=BLR, Criteria=Price; none of these arguments are valid parameters for weather_forecast_service.",
      "Trace divergence pattern matches cluster #482 ('Mismatched Travel Connector') observed in 94% of similar failed traces.",
      "Downstream Step 6 and Step 7 inherited null pricing structures, forcing terminal hallucination.",
    ],
    suspicionDistribution: [
      { stepId: 1, stepTitle: "Parse request constraints", score: 0.02, isSuspected: false },
      { stepId: 2, stepTitle: "Determine strategy & tools", score: 0.06, isSuspected: false },
      { stepId: 3, stepTitle: "Retrieve user preferences", score: 0.04, isSuspected: false },
      { stepId: 4, stepTitle: "Resolve service connector", score: 0.18, isSuspected: false },
      { stepId: 5, stepTitle: "Execute weather_forecast_service", score: 0.91, isSuspected: true },
      { stepId: 6, stepTitle: "Process tool output payload", score: 0.44, isSuspected: false },
      { stepId: 7, stepTitle: "Synthesize user response", score: 0.38, isSuspected: false },
    ],
    suggestedAlternative: {
      toolName: "flight_inventory_search",
      arguments: {
        origin: "BOM",
        destination: "BLR",
        departureDate: "2026-10-04",
        cabinClass: "economy",
        sortBy: "price_asc",
      },
      explanation:
        "Replace weather_forecast_service with flight_inventory_search to query live GDS carrier inventory for lowest available fares.",
    },
  },
  run_0140: {
    runId: "run_0140",
    predictedFailureStep: 4,
    confidence: 0.88,
    failureType: "wrong_argument",
    explanation:
      "The agent executed 'kubectl scale deployment --replicas=0' in response to an OOMKilled signal. Decreasing replica count to zero took the critical service completely offline rather than addressing the container memory limit threshold.",
    evidence: [
      "Container termination reason was OOMKilled (Exit Code 137, limit 512Mi), not resource thrashing or deadlocks.",
      "Command arguments passed '--replicas=0' which contradicts the objective of resolving CrashLoopBackOff without downtime.",
      "Cluster telemetry recorded immediate 100% 503 HTTP gateway drop following Step 4.",
    ],
    suspicionDistribution: [
      { stepId: 1, stepTitle: "Poll alert manager", score: 0.01, isSuspected: false },
      { stepId: 2, stepTitle: "Determine remediation", score: 0.12, isSuspected: false },
      { stepId: 3, stepTitle: "Inspect container termination", score: 0.08, isSuspected: false },
      { stepId: 4, stepTitle: "Execute kubectl scale --replicas=0", score: 0.88, isSuspected: true },
      { stepId: 5, stepTitle: "Report status to SRE", score: 0.32, isSuspected: false },
    ],
    suggestedAlternative: {
      toolName: "kubectl_patch_resources",
      arguments: {
        deployment: "payment-gateway",
        namespace: "prod-payments",
        memoryLimit: "1Gi",
        memoryRequest: "768Mi",
      },
      explanation: "Patch deployment memory limits to 1Gi to allow heap headroom without killing pods.",
    },
  },
  run_0139: {
    runId: "run_0139",
    predictedFailureStep: 2,
    confidence: 0.94,
    failureType: "bad_retrieval",
    explanation:
      "The retrieval pipeline surfaced a deprecated policy document (refund_policy_v2023.md) instead of the active 2026 customer terms. The customer was within the valid 30-day window, but was wrongly rejected using the 14-day rule.",
    evidence: [
      "Corpus document timestamp was 2023-04-12, lacking the 'v2026-active' metadata tag.",
      "Vector search query missed partition filter: { active: true, policyYear: 2026 }.",
      "Decision engine directly relied on stale chunk tokens at Step 3.",
    ],
    suspicionDistribution: [
      { stepId: 1, stepTitle: "Extract order ID", score: 0.01, isSuspected: false },
      { stepId: 2, stepTitle: "Retrieve return policy", score: 0.94, isSuspected: true },
      { stepId: 3, stepTitle: "Assess eligibility", score: 0.42, isSuspected: false },
      { stepId: 4, stepTitle: "Reject customer ticket", score: 0.29, isSuspected: false },
    ],
    suggestedAlternative: {
      toolName: "policy_knowledge_retriever",
      arguments: {
        query: "customer return eligibility window",
        filter: { year: 2026, status: "active" },
      },
      explanation: "Filter vector search strictly to active 2026 customer terms.",
    },
  },
  run_0137: {
    runId: "run_0137",
    predictedFailureStep: 3,
    confidence: 0.86,
    failureType: "premature_completion",
    explanation:
      "The agent aborted coupon testing after code 'SAVE10' failed. 3 additional promo candidates remained in the array ('FALL25', 'VIP50', 'FREESHIP') but were ignored due to premature loop termination.",
    evidence: [
      "Iteration index exited at i=0 with array length 4.",
      "Agent logic treated a single 400 error as non-retryable global failure.",
      "Customer was billed full price $340 despite eligible 'FALL25' ($85 discount) existing.",
    ],
    suspicionDistribution: [
      { stepId: 1, stepTitle: "Parse active discount list", score: 0.02, isSuspected: false },
      { stepId: 2, stepTitle: "Test coupon SAVE10", score: 0.15, isSuspected: false },
      { stepId: 3, stepTitle: "Halt coupon verification loop", score: 0.86, isSuspected: true },
      { stepId: 4, stepTitle: "Submit order zero discount", score: 0.35, isSuspected: false },
    ],
    suggestedAlternative: {
      toolName: "batch_validate_promo_codes",
      arguments: {
        codes: ["FALL25", "VIP50", "FREESHIP"],
        cartTotal: 340,
        selectHighestDiscount: true,
      },
      explanation: "Exhaustively validate remaining promotion codes to find highest discount.",
    },
  },
};
