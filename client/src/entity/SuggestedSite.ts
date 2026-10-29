import { isRecent, SUGGESTION_MAX_AGE_MS } from "./freshness";
import type { RecommendationKind } from "./RecommendationKind";
import { Site, type SiteProps } from "./Site";

export interface SuggestedSiteProps extends SiteProps {
  name: string;
  score: number;
  summary: string;
  asOf: Date;
}

/** A place the server scored for one kind of suggestion: the design model's SuggestedSite, a Site with a score. */
export abstract class SuggestedSite extends Site {
  readonly name: string;
  /** How good the site is, from 0 to 1, before distance counts (D28, D29). */
  readonly score: number;
  /** Why, in a few words, e.g. "City Hall very crowded · 3 empty taxis nearby". */
  readonly summary: string;
  /** When the server scored it. */
  readonly asOf: Date;

  constructor(props: SuggestedSiteProps) {
    super({ id: props.id, centre: props.centre, radius: props.radius });
    this.name = props.name;
    this.score = props.score;
    this.summary = props.summary;
    this.asOf = props.asOf;
  }

  abstract getKind(): RecommendationKind;

  /** Scored recently enough to suggest (D36). */
  isFresh(now: Date): boolean {
    return isRecent(this.asOf, now, SUGGESTION_MAX_AGE_MS[this.getKind()]);
  }

  /** The last moment it is fresh. */
  freshUntil(): Date {
    return new Date(this.asOf.getTime() + SUGGESTION_MAX_AGE_MS[this.getKind()]);
  }
}
