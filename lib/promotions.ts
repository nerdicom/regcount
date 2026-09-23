export const NERDI_URL = 'https://www.nerdi.com/web-design/?utm_source=regcount&utm_medium=referral&utm_campaign=research';
export const DNLAUNCH_URL = 'https://dnlaunch.com/?page=browse&utm_source=regcount&utm_medium=referral&utm_campaign=research';
export const ADVERTISING_EMAIL = 'info@regcount.com';
export const ADVERTISING_MAILTO = `mailto:${ADVERTISING_EMAIL}?subject=${encodeURIComponent('Advertising on RegCount')}&body=${encodeURIComponent('Hi RegCount,\n\nI would like to discuss a sponsored placement.\n\nBusiness / product:\nWebsite:\nPreferred dates:\nBudget range:\nWhat we would like to promote:\n\nThank you!')}`;

export type Sponsor = { name: string; headline: string; description: string; url: string; cta: string };

// Only public campaign copy is returned. Never pass the full environment to a client.
// Invalid/incomplete configurations fall back to the existing owner promotion.
export function configuredSponsor(env: Record<string, string | undefined>): Sponsor | null {
  const name = env.REGCOUNT_SPONSOR_NAME?.trim();
  const headline = env.REGCOUNT_SPONSOR_HEADLINE?.trim();
  const description = env.REGCOUNT_SPONSOR_DESCRIPTION?.trim();
  const destination = env.REGCOUNT_SPONSOR_URL?.trim();
  const cta = env.REGCOUNT_SPONSOR_CTA?.trim();
  if (!name || !headline || !description || !destination || !cta) return null;
  if (name.length > 40 || headline.length > 90 || description.length > 180 || cta.length > 32 || destination.length > 2048) return null;
  try {
    const url = new URL(destination);
    if (url.protocol !== 'https:' || url.username || url.password) return null;
    return { name, headline, description, url: url.href, cta };
  } catch {
    return null;
  }
}
