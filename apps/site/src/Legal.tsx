import { PageHead, Prose } from "./Page";

const CONTACT = "hello@youasked.dev";
const Mail = () => <a href={`mailto:${CONTACT}`}>{CONTACT}</a>;

export function PrivacyPage() {
  return (
    <>
      <PageHead path="/privacy" eyebrow="Legal" title="Privacy policy" lede="Last updated 3 November 2026" />
      <div className="wrap narrow-doc">
        <Prose>
          <p>
            YouAsked is run by Aden Teo (YouAsked), Singapore. This page explains what we handle, why, and who helps us do it. Questions: <Mail />.
          </p>

          <h2>Developer accounts</h2>
          <p>
            When you sign in we store your email, and your name and avatar if you use Google or GitHub. You can also sign in with an email link. We use this to run your account, workspaces and billing.
          </p>

          <h2>What apps send about their users</h2>
          <p>YouAsked is used inside other developers&rsquo; apps. When someone uses the widget, the app can send us:</p>
          <ul>
            <li>a signed user ID (or an anonymous device ID);</li>
            <li>email and name, only if the app chooses to pass them;</li>
            <li>the text of requests and comments, votes, and screenshots people attach;</li>
            <li>the page or topic they were on when they asked.</li>
          </ul>
          <p>
            The developer of the app decides what to send and is the controller of that data. We process it on their behalf. If you use an app that uses YouAsked and want your data removed, ask that app&rsquo;s developer, or write to us and we will pass it on.
          </p>

          <h2>Cookies and device storage</h2>
          <p>
            We set one session cookie on youasked.dev to keep developers signed in. The widget stores an anonymous ID in the device&rsquo;s local storage so a visitor can vote and get replies without an account. We don&rsquo;t use advertising or tracking cookies.
          </p>

          <h2>Who else handles data</h2>
          <ul>
            <li>
              <b>Cloudflare:</b> hosting, database, file storage, Workers AI and email sending.
            </li>
            <li>
              <b>Stripe:</b> billing. We never see full card numbers.
            </li>
            <li>
              <b>Google and GitHub:</b> sign-in.
            </li>
            <li>
              <b>Telegram, Slack and Discord:</b> only when a developer connects them to receive requests.
            </li>
            <li>
              <b>ScrapeCreators:</b> fetches public Reddit posts for the Heard elsewhere feature. Only public posts and App Store reviews are read.
            </li>
          </ul>

          <h2>No selling, no ads</h2>
          <p>We don&rsquo;t sell data, and we don&rsquo;t show ads.</p>

          <h2>Your rights</h2>
          <p>
            You can ask for access to your data, a copy of it, or deletion. Developers can export their data from the dashboard. For anything else, or for deletion, email <Mail />. We keep data while an account is active and delete it within 30 days of a deletion request.
          </p>
        </Prose>
      </div>
    </>
  );
}

export function TermsPage() {
  return (
    <>
      <PageHead path="/terms" eyebrow="Legal" title="Terms of service" lede="Last updated 3 November 2026" />
      <div className="wrap narrow-doc">
        <Prose>
          <p>
            These terms cover your use of YouAsked, run by Aden Teo (YouAsked), Singapore. By creating an account or using the service you agree to them. Contact: <Mail />.
          </p>

          <h2>Subscriptions</h2>
          <p>
            Plans bill monthly or yearly and renew until you cancel. Cancel any time and the plan runs to the end of the period you paid for. See <a href="/pricing">pricing</a> for plans.
          </p>

          <h2>Money-back guarantee</h2>
          <p>
            Your first payment has a 14-day money-back guarantee. Tell us within 14 days and we refund it.
          </p>

          <h2>Founding price</h2>
          <p>The founding price lasts for as long as your subscription stays active. If it lapses, the regular price applies when you return.</p>

          <h2>Acceptable use</h2>
          <p>Don&rsquo;t use YouAsked to send spam or to host or distribute illegal content. We may suspend accounts that do.</p>

          <h2>Your app and its users</h2>
          <p>
            You are responsible for your app&rsquo;s users and for getting any consent you need before sending their data to YouAsked. See the <a href="/privacy">privacy policy</a> for what we handle.
          </p>

          <h2>No warranty and limits</h2>
          <p>
            The service is provided as is, without warranties. Our total liability to you is limited to the fees you paid in the 12 months before the claim.
          </p>

          <h2>Self-hosting</h2>
          <p>
            Running the server yourself is governed by the FSL licence in the{" "}
            <a href="https://github.com/youasked/youasked">repository</a>, not by these terms.
          </p>

          <h2>Governing law</h2>
          <p>These terms are governed by the laws of Singapore.</p>
        </Prose>
      </div>
    </>
  );
}
