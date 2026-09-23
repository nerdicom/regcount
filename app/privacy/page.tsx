import Link from 'next/link';
import { ContentLayout } from '@/components/content-layout';
import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata('Privacy Policy', 'How RegCount handles sign-in information, session cookies, domain searches, and privacy requests.', '/privacy', false);

export default function PrivacyPage() {
  return <ContentLayout label="YOUR PRIVACY" title="Privacy policy" intro="This policy explains how information is handled when you use regcount.com, including Google and Facebook sign-in." breadcrumbs={[{ name: 'Privacy policy', path: '/privacy' }]}>
    <div className="guide-prose methodology-prose">
      <p className="article-meta">Effective September 23, 2026</p>
      <section><h2>Information used for sign-in</h2>
        <p>When you choose Google or Facebook sign-in, RegCount receives your name, the provider&apos;s account identifier, and your email address when the provider makes it available. Google may also supply a profile image with your basic profile; RegCount does not retain that image in your account session.</p>
        <p>We use these details to authenticate you, display your account, and maintain your signed-in session. Your Google or Facebook password is handled by that provider and is not received by RegCount. We request basic profile and email access; we do not request access to your posts, contacts, friends, or messages.</p>
      </section>
      <section><h2>Session cookies and storage</h2>
        <p>The current version of RegCount keeps your name, email when available, provider, and account identifier in an encrypted session cookie on your device. The session is processed by our server when you use account features. RegCount does not currently maintain a separate user database or saved-search history.</p>
        <p>Session cookies have a seven-day lifetime that can be renewed while you use the site. Authentication also uses cookies to protect the sign-in process and remember where to return you. Signing out removes the signed-in session from that browser. You can clear remaining cookies using your browser&apos;s site-data controls.</p>
      </section>
      <section><h2>Domain searches</h2>
        <p>We process the names you submit to return search results and bulk comparisons. Single-name searches can appear in the page URL and your browser history. CSV exports are generated in your browser and saved wherever you choose to download them.</p>
        <p>Sample results are processed by RegCount. When a result is labeled as live provider data, the search term is sent to the named registration data provider, currently dotDB. We do not send your Google or Facebook account details with those search requests. Live results may be cached temporarily to avoid repeating provider requests.</p>
      </section>
      <section><h2>Hosting, service providers, and technical records</h2>
        <p>Hostinger provides our website hosting. Hosting and security systems may process technical information such as IP addresses, request URLs, browser details, timestamps, and errors to deliver and protect the service. These records may include a search term that appears in a URL and may remain after you sign out.</p>
        <p>Google and Meta process sign-in requests under their own privacy policies. If you email us, your address and message are processed by our email service to help us respond. RegCount&apos;s application does not use your sign-in information for advertising or sell it.</p>
        <p>Service providers may process information in countries other than your own. You can read the <a href="https://policies.google.com/privacy">Google Privacy Policy</a>, <a href="https://www.facebook.com/privacy/policy/">Meta Privacy Policy</a>, and <a href="https://www.hostinger.com/legal/privacy-policy">Hostinger Privacy Policy</a> for their practices.</p>
      </section>
      <section><h2>Your choices and deletion requests</h2>
        <p>You can use the public domain research tools without signing in. You can sign out, clear site data, and remove RegCount&apos;s connection in your Google or Facebook account settings. Removing that connection does not automatically clear a RegCount session already stored in a browser.</p>
        <p>To ask about access, correction, or deletion of information associated with you, email <a href="mailto:info@regcount.com">info@regcount.com</a>. We may need to verify that a request relates to your account. Please do not send passwords, access tokens, or identity documents in your initial message.</p>
        <p>Our <Link href="/data-deletion">data deletion instructions</Link> explain how to remove a session and request help with other records. Some technical or correspondence records may need to be retained for security or legal obligations; we will explain any applicable limitation when responding to your request.</p>
      </section>
      <section><h2>Contact and updates</h2>
        <p>For questions about RegCount&apos;s handling of information, contact <a href="mailto:info@regcount.com">info@regcount.com</a>. We will update this page and its effective date when these practices change.</p>
      </section>
    </div>
  </ContentLayout>;
}
