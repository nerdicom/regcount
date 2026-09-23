import Link from 'next/link';
import { ContentLayout } from '@/components/content-layout';
import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata('Data Deletion Instructions', 'Remove your RegCount session, disconnect Facebook or Google, and request deletion assistance.', '/data-deletion', false);

export default function DataDeletionPage() {
  return <ContentLayout label="YOUR ACCOUNT" title="Data deletion instructions" intro="You can remove your RegCount session, disconnect your sign-in provider, and contact us about other information associated with you." breadcrumbs={[{ name: 'Data deletion', path: '/data-deletion' }]}>
    <div className="guide-prose methodology-prose">
      <p className="article-meta">Updated September 23, 2026</p>
      <section><h2>1. Remove your RegCount session</h2>
        <p>Open your <Link href="/account">RegCount account</Link> and choose <strong>Sign out</strong>. Repeat this in each browser or device where you signed in. If you cannot reach the account page, use your browser&apos;s settings to clear cookies and site data for regcount.com.</p>
        <p>The current version stores account details in an encrypted session cookie and has no separate user database or saved-search history. Sessions have a seven-day lifetime that can be renewed while you use the site. Signing out or clearing site data removes the session from that browser immediately.</p>
      </section>
      <section><h2>2. Disconnect Facebook or Google</h2>
        <p><strong>Facebook:</strong> Open Facebook&apos;s settings and find <strong>Apps and websites</strong>. Select <strong>regcount.com</strong> or <strong>RegCount</strong>, then choose <strong>Remove</strong> and complete Facebook&apos;s confirmation.</p>
        <p><strong>Google:</strong> Open your Google Account&apos;s third-party connections settings, select <strong>RegCount</strong>, and remove its Sign in with Google connection.</p>
        <p>Disconnecting a provider removes that provider connection. It does not clear RegCount cookies on your devices, so complete the sign-out step above as well. Signing in again creates a new RegCount session.</p>
      </section>
      <section><h2>3. Request help with data deletion</h2>
        <p>Email <a href="mailto:info@regcount.com?subject=RegCount%20data%20deletion%20request">info@regcount.com</a> with the subject <strong>RegCount data deletion request</strong>. Include the email associated with your sign-in, which provider you used, and what you would like removed. If Facebook did not share an email address, tell us that so we can arrange another way to identify the relevant information.</p>
        <p>We will review the request, verify ownership when needed, and explain what information we hold and the outcome. Do not send your password, provider access tokens, or identity documents in the initial email.</p>
        <p>Hosting and security logs or prior email correspondence may remain separately from your browser session. We will explain any records that must be retained for security or legal obligations. Deleting RegCount data does not delete your Google or Facebook account.</p>
      </section>
      <section><h2>Copies on your device</h2>
        <p>Downloaded CSV files and browser history stay on your device until you remove them. RegCount cannot delete those local copies remotely.</p>
        <p>Read our <Link href="/privacy">privacy policy</Link> for more about the information used by the service.</p>
      </section>
    </div>
  </ContentLayout>;
}
