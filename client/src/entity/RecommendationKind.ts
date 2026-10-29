/** The design model's RecommendationKind: the two smart suggestions (FR-1.3). */
export const RECOMMENDATION_KINDS = ["PICKUP", "REST_STOP"] as const;
export type RecommendationKind = (typeof RECOMMENDATION_KINDS)[number];

/** True if `value` is one of the two suggestion names. Narrows `unknown` to `RecommendationKind`. */
export function isRecommendationKind(value: unknown): value is RecommendationKind {
  return (RECOMMENDATION_KINDS as readonly unknown[]).includes(value);
}
