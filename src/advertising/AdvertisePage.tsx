import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import logoUrl from "../assets/mmorpg-top-100-logo-web.png";
import { siteConfig } from "../config/site";
import {
  advertiserAuthService as defaultAuthService,
  advertisingService as defaultAdvertisingService,
} from "./advertisingServices";
import { BannerUploadForm } from "./BannerUploadForm";
import type {
  AdvertiserAuthService,
  AdvertisingService,
  AdvertisingWorkspace,
} from "./types";
import "./AdvertisePage.css";

type Props = {
  authService?: AdvertiserAuthService;
  advertisingService?: AdvertisingService;
};

export default function AdvertisePage({
  authService = defaultAuthService,
  advertisingService = defaultAdvertisingService,
}: Props) {
  const [state, setState] = useState<
    "checking" | "signed-out" | "verify-email" | "loading" | "ready" | "error"
  >("checking");
  const [workspace, setWorkspace] = useState<AdvertisingWorkspace>({
    servers: [],
    packages: [],
    claims: [],
  });
  const [authPending, setAuthPending] = useState(false);
  const [authFeedback, setAuthFeedback] = useState("");
  const [authErrors, setAuthErrors] = useState<Record<string, string>>({});
  const [claimPending, setClaimPending] = useState(false);
  const [claimFeedback, setClaimFeedback] = useState("");
  const [claimErrors, setClaimErrors] = useState<Record<string, string>>({});
  const [reload, setReload] = useState(0);
  const [focusClaimResult, setFocusClaimResult] = useState(0);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const serverRef = useRef<HTMLSelectElement>(null);
  const packageRef = useRef<HTMLSelectElement>(null);
  const referenceRef = useRef<HTMLInputElement>(null);
  const turnstileRef = useRef<HTMLDivElement>(null);
  const claimResultRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (focusClaimResult === 0) return;
    claimResultRef.current?.focus();
  }, [focusClaimResult]);

  useEffect(() => {
    let active = true;
    authService.currentStatus().then((status) => {
      if (!active) return;
      if (status !== "ready") return setState(status);
      setState("loading");
      advertisingService.loadWorkspace().then(
        (data) => {
          if (active) {
            setWorkspace(data);
            setState("ready");
          }
        },
        () => {
          if (active) setState("error");
        },
      );
    });
    return () => {
      active = false;
    };
  }, [advertisingService, authService, reload]);

  const authenticate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const submitter = (event.nativeEvent as SubmitEvent)
      .submitter as HTMLButtonElement | null;
    const data = new FormData(event.currentTarget);
    const email = String(data.get("email") ?? "").trim();
    const password = String(data.get("password") ?? "");
    setAuthFeedback("");
    const errors: Record<string, string> = {};
    if (!email || !email.includes("@"))
      errors.email = "Please enter a valid email address.";
    if (password.length < 8)
      errors.password = "Enter a password with at least 8 characters.";
    setAuthErrors(errors);
    if (Object.keys(errors).length > 0) {
      if (errors.email) emailRef.current?.focus();
      else passwordRef.current?.focus();
      return;
    }
    setAuthPending(true);
    try {
      const result =
        submitter?.value === "register"
          ? await authService.register(email, password)
          : await authService.signIn(email, password);
      setState(result);
      if (result === "verify-email")
        setAuthFeedback("Verify your email address before continuing.");
    } catch {
      setAuthFeedback(
        "The account could not be accessed. Check the details and try again.",
      );
    } finally {
      setAuthPending(false);
    }
  };

  const submitClaim = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const input = {
      serverId: String(data.get("serverId") ?? ""),
      packageCode: String(data.get("packageCode") ?? ""),
      donorReference: String(data.get("donorReference") ?? ""),
      turnstileToken: String(data.get("cf-turnstile-response") ?? ""),
    };
    setClaimFeedback("");
    const errors: Record<string, string> = {};
    if (!input.serverId) errors.serverId = "Select an approved server.";
    if (!input.packageCode) errors.packageCode = "Select a placement duration.";
    if (input.donorReference.trim().length < 8)
      errors.donorReference = "Enter a valid PayPal transaction reference.";
    if (!input.turnstileToken)
      errors.turnstileToken = "Complete the security check.";
    setClaimErrors(errors);
    if (Object.keys(errors).length > 0) {
      if (errors.serverId) serverRef.current?.focus();
      else if (errors.packageCode) packageRef.current?.focus();
      else if (errors.donorReference) referenceRef.current?.focus();
      else turnstileRef.current?.focus();
      return;
    }
    setClaimPending(true);
    try {
      const result = await advertisingService.createClaim(input);
      setClaimFeedback(result.message);
      if (result.ok) {
        form.reset();
        setWorkspace(await advertisingService.loadWorkspace());
        setFocusClaimResult((value) => value + 1);
      }
    } catch {
      setClaimFeedback(
        "Your donation claim could not be submitted. Please try again later.",
      );
    } finally {
      setClaimPending(false);
    }
  };

  const sendVerification = async () => {
    setAuthPending(true);
    try {
      await authService.sendVerification();
      setAuthFeedback("A new verification email was sent.");
    } catch {
      setAuthFeedback("The verification email could not be sent.");
    } finally {
      setAuthPending(false);
    }
  };

  const refreshVerification = async () => {
    setAuthPending(true);
    try {
      if (await authService.refreshVerification())
        setReload((value) => value + 1);
      else setAuthFeedback("Your email address is not verified yet.");
    } catch {
      setAuthFeedback("Verification could not be checked.");
    } finally {
      setAuthPending(false);
    }
  };

  return (
    <div className="advertise-page">
      <a className="skip-link" href="#advertise-main">
        Skip to main content
      </a>
      <header className="advertise-header">
        <a href="/" aria-label="MMORPG Top 100 home">
          <img src={logoUrl} alt="MMORPG Top 100" />
        </a>
        <a href="/">Back to rankings</a>
      </header>
      <main id="advertise-main">
        <section className="advertise-intro">
          <p className="eyebrow">Exclusive servers</p>
          <h1>Request game-specific advertising</h1>
          <p>
            Choose an approved server and a 7-day or 30-day placement. Donations
            and banners are reviewed manually before any advertisement can
            appear.
          </p>
        </section>
        {state === "checking" && <p role="status">Checking your account...</p>}
        {state === "loading" && (
          <p role="status">Loading your advertising workspace...</p>
        )}
        {state === "error" && (
          <p role="alert">
            The advertising workspace is unavailable right now. Please try again
            later.
          </p>
        )}
        {state === "signed-out" && (
          <section
            className="advertiser-auth"
            aria-labelledby="owner-account-heading"
          >
            <h2 id="owner-account-heading">Server owner account</h2>
            <p>
              Sign in or create an account. Your email address must be verified.
            </p>
            <form onSubmit={(event) => void authenticate(event)} noValidate>
              <label htmlFor="advertiser-email">Email address</label>
              <input
                ref={emailRef}
                id="advertiser-email"
                name="email"
                type="email"
                autoComplete="username"
                aria-invalid={Boolean(authErrors.email)}
                aria-describedby={
                  authErrors.email ? "advertiser-email-error" : undefined
                }
              />
              {authErrors.email && (
                <p id="advertiser-email-error" className="field-error">
                  {authErrors.email}
                </p>
              )}
              <label htmlFor="advertiser-password">Password</label>
              <input
                ref={passwordRef}
                id="advertiser-password"
                name="password"
                type="password"
                minLength={8}
                autoComplete="current-password"
                aria-invalid={Boolean(authErrors.password)}
                aria-describedby={
                  authErrors.password ? "advertiser-password-error" : undefined
                }
              />
              {authErrors.password && (
                <p id="advertiser-password-error" className="field-error">
                  {authErrors.password}
                </p>
              )}
              <div className="advertiser-auth-actions">
                <button type="submit" value="sign-in" disabled={authPending}>
                  Sign in
                </button>
                <button type="submit" value="register" disabled={authPending}>
                  Create account
                </button>
              </div>
            </form>
            {authFeedback && <p role="status">{authFeedback}</p>}
          </section>
        )}
        {state === "verify-email" && (
          <section
            className="advertiser-auth"
            aria-labelledby="verify-owner-heading"
          >
            <h2 id="verify-owner-heading">Verify your email address</h2>
            <p>Use the link in your verification email, then return here.</p>
            <div className="advertiser-auth-actions">
              <button
                type="button"
                disabled={authPending}
                onClick={() => void sendVerification()}
              >
                Send another email
              </button>
              <button
                type="button"
                disabled={authPending}
                onClick={() => void refreshVerification()}
              >
                I have verified my email
              </button>
            </div>
            {authFeedback && <p role="status">{authFeedback}</p>}
          </section>
        )}
        {state === "ready" && (
          <>
            <section className="claim-panel" aria-labelledby="claim-heading">
              <div>
                <h2 id="claim-heading">Submit a donation claim</h2>
                <p>
                  Donate through PayPal first, then enter the transaction
                  reference for manual matching. A claim never guarantees
                  approval.
                </p>
                <a
                  className="paypal-link"
                  href={siteConfig.paypalDonationUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Open PayPal donation page{" "}
                  <span className="visually-hidden">(opens in a new tab)</span>
                </a>
              </div>
              {workspace.servers.length === 0 ||
              workspace.packages.length === 0 ? (
                <p role="status">
                  You need an approved server and an available advertising
                  package before submitting a claim.
                </p>
              ) : (
                <form onSubmit={(event) => void submitClaim(event)} noValidate>
                  <label htmlFor="claim-server">Approved server</label>
                  <select
                    ref={serverRef}
                    id="claim-server"
                    name="serverId"
                    defaultValue=""
                    aria-invalid={Boolean(claimErrors.serverId)}
                    aria-describedby={
                      claimErrors.serverId ? "claim-server-error" : undefined
                    }
                  >
                    <option value="" disabled>
                      Select a server
                    </option>
                    {workspace.servers.map((server) => (
                      <option key={server.id} value={server.id}>
                        {server.name} - {server.gameName}
                      </option>
                    ))}
                  </select>
                  {claimErrors.serverId && (
                    <p id="claim-server-error" className="field-error">
                      {claimErrors.serverId}
                    </p>
                  )}
                  <label htmlFor="claim-package">Placement duration</label>
                  <select
                    ref={packageRef}
                    id="claim-package"
                    name="packageCode"
                    defaultValue=""
                    aria-invalid={Boolean(claimErrors.packageCode)}
                    aria-describedby={
                      claimErrors.packageCode
                        ? "claim-package-error"
                        : undefined
                    }
                  >
                    <option value="" disabled>
                      Select a duration
                    </option>
                    {workspace.packages.map((pkg) => (
                      <option key={pkg.code} value={pkg.code}>
                        {pkg.durationDays} days -{" "}
                        {formatMoney(pkg.priceMinor, pkg.currency)}
                      </option>
                    ))}
                  </select>
                  {claimErrors.packageCode && (
                    <p id="claim-package-error" className="field-error">
                      {claimErrors.packageCode}
                    </p>
                  )}
                  <label htmlFor="donor-reference">
                    PayPal transaction reference
                  </label>
                  <input
                    ref={referenceRef}
                    id="donor-reference"
                    name="donorReference"
                    type="text"
                    minLength={8}
                    maxLength={128}
                    autoComplete="off"
                    aria-invalid={Boolean(claimErrors.donorReference)}
                    aria-describedby={
                      claimErrors.donorReference
                        ? "donor-reference-error"
                        : undefined
                    }
                  />
                  {claimErrors.donorReference && (
                    <p id="donor-reference-error" className="field-error">
                      {claimErrors.donorReference}
                    </p>
                  )}
                  <p id="security-check-label">Security check</p>
                  <div
                    ref={turnstileRef}
                    tabIndex={-1}
                    role="group"
                    aria-labelledby="security-check-label"
                    aria-describedby={
                      claimErrors.turnstileToken
                        ? "security-check-error"
                        : undefined
                    }
                  >
                    <div
                      className="cf-turnstile"
                      data-sitekey={import.meta.env.VITE_TURNSTILE_SITE_KEY}
                      data-action="donation-claim"
                      data-theme="dark"
                      data-size="compact"
                    />
                  </div>
                  {claimErrors.turnstileToken && (
                    <p
                      id="security-check-error"
                      className="field-error"
                      role="alert"
                    >
                      {claimErrors.turnstileToken}
                    </p>
                  )}
                  <button type="submit" disabled={claimPending}>
                    {claimPending
                      ? "Submitting..."
                      : "Submit for manual review"}
                  </button>
                  {claimFeedback && (
                    <p ref={claimResultRef} tabIndex={-1} role="status">
                      {claimFeedback}
                    </p>
                  )}
                </form>
              )}
            </section>
            <section
              className="claim-history"
              aria-labelledby="claim-history-heading"
            >
              <div className="claim-history-heading">
                <h2 id="claim-history-heading">Your claims</h2>
                <button
                  type="button"
                  onClick={() =>
                    void authService
                      .signOut()
                      .then(() => setState("signed-out"))
                  }
                >
                  Sign out
                </button>
              </div>
              {workspace.claims.length === 0 ? (
                <p>There are no donation claims yet.</p>
              ) : (
                <ul>
                  {workspace.claims.map((claim) => (
                    <li key={claim.id}>
                      <strong>{claim.serverName}</strong>
                      <span>
                        {claim.gameName} | {claim.durationDays} days
                      </span>
                      <span className={`claim-status ${claim.status}`}>
                        {claim.status}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
            <BannerUploadForm servers={workspace.servers} />
          </>
        )}
      </main>
    </div>
  );
}

function formatMoney(amountMinor: string, currency: string) {
  return new Intl.NumberFormat("en", { style: "currency", currency }).format(
    Number(amountMinor) / 100,
  );
}
