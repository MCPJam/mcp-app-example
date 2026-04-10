import { StytchUIClient, parseOAuthAuthorizeParams } from "@stytch/vanilla-js";

const STYTCH_PUBLIC_TOKEN =
  "public-token-test-c906e7e1-85fe-4da8-a0c4-d024b64379eb";

const stytch = new StytchUIClient(STYTCH_PUBLIC_TOKEN);

const root = document.getElementById("root")!;
const isLoginPage = window.location.pathname === "/login";

// ── Login page ────────────────────────────────────────────────────

function showLogin() {
  const urlParams = new URLSearchParams(window.location.search);
  const returnTo = urlParams.get("returnTo") || "/";

  // Handle OAuth callback from Stytch (Google redirect back)
  const token = urlParams.get("token");
  const tokenType = urlParams.get("stytch_token_type");

  if (token && tokenType === "oauth") {
    root.innerHTML = `
      <div style="max-width:400px;margin:80px auto;font-family:system-ui;text-align:center">
        <p>Authenticating...</p>
      </div>
    `;
    stytch.oauth.authenticate(token, { session_duration_minutes: 60 })
      .then(() => {
        // Retrieve the returnTo we saved before redirecting to Google
        const savedReturnTo = sessionStorage.getItem("oauth_return_to") || "/";
        sessionStorage.removeItem("oauth_return_to");
        window.location.href = savedReturnTo;
      })
      .catch((err: Error) => {
        console.error("OAuth auth failed:", err);
        root.innerHTML = `
          <div style="max-width:400px;margin:80px auto;font-family:system-ui;text-align:center">
            <p style="color:#dc2626">Authentication failed. <a href="/login?returnTo=${encodeURIComponent(returnTo)}">Try again</a></p>
          </div>
        `;
      });
    return;
  }

  root.innerHTML = `
    <div style="max-width:400px;margin:80px auto;font-family:system-ui">
      <div style="background:#fff;border-radius:12px;border:1px solid #e5e7eb;padding:32px">
        <h2 style="text-align:center;margin:0 0 8px;font-size:20px">Sign in to continue</h2>
        <p style="text-align:center;color:#6b7280;font-size:14px;margin:0 0 24px">Sign in to authorize access</p>
        <button
          id="btn-google"
          style="width:100%;padding:12px;background:#fff;color:#111;border:1px solid #d1d5db;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px"
        >
          <svg width="18" height="18" viewBox="0 0 18 18"><path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z"/><path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z"/><path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.997 8.997 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z"/><path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58Z"/></svg>
          Continue with Google
        </button>
      </div>
    </div>
  `;

  document.getElementById("btn-google")!.addEventListener("click", () => {
    // Save returnTo before redirecting away to Google
    sessionStorage.setItem("oauth_return_to", returnTo);

    const loginRedirectURL = `${window.location.origin}/login`;
    stytch.oauth.google.start({
      login_redirect_url: loginRedirectURL,
      signup_redirect_url: loginRedirectURL,
    });
  });
}

// ── Authorize page (consent flow) ─────────────────────────────────

async function showAuthorize() {
  const session = stytch.session.getSync();

  if (!session) {
    const returnTo = encodeURIComponent(window.location.href);
    window.location.href = `/login?returnTo=${returnTo}`;
    return;
  }

  const searchParams = new URLSearchParams(window.location.search);
  const parsed = parseOAuthAuthorizeParams(searchParams);
  const params = parsed.result;

  root.innerHTML = `
    <div style="max-width:480px;margin:80px auto;font-family:system-ui">
      <div style="background:#fff;border-radius:12px;border:1px solid #e5e7eb;overflow:hidden">
        <div style="padding:24px;border-bottom:1px solid #e5e7eb;text-align:center">
          <h1 style="font-size:20px;font-weight:600;margin:0">Authorization Request</h1>
        </div>
        <div style="padding:24px">
          <p id="consent-text" style="color:#374151;font-size:14px;margin-bottom:20px">Loading...</p>
          <div id="consent-error" style="display:none;padding:12px;background:#fef2f2;border:1px solid #fecaca;border-radius:8px;margin-bottom:16px;color:#991b1b;font-size:14px"></div>
          <div style="display:flex;gap:12px">
            <button id="btn-allow" disabled style="flex:1;padding:12px;background:#111;color:#fff;border:none;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer">Allow</button>
            <button id="btn-deny" disabled style="flex:1;padding:12px;background:#fff;color:#111;border:1px solid #d1d5db;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer">Deny</button>
          </div>
        </div>
      </div>
    </div>
  `;

  const consentText = document.getElementById("consent-text")!;
  const consentError = document.getElementById("consent-error")!;
  const btnAllow = document.getElementById("btn-allow") as HTMLButtonElement;
  const btnDeny = document.getElementById("btn-deny") as HTMLButtonElement;

  try {
    const authInfo = await stytch.idp.oauthAuthorizeStart({
      ...params,
      response_type: "code",
    });

    consentText.innerHTML =
      `<strong>${(authInfo as any).client_name || "An application"}</strong> ` +
      `is requesting access to your account.`;
    btnAllow.disabled = false;
    btnDeny.disabled = false;
  } catch (err) {
    console.error("oauthAuthorizeStart failed:", err);
    consentText.textContent = "Failed to load authorization details.";
    return;
  }

  async function handleConsent(granted: boolean) {
    btnAllow.disabled = true;
    btnDeny.disabled = true;
    btnAllow.textContent = "Authorizing...";

    try {
      const response = await stytch.idp.oauthAuthorizeSubmit({
        ...params,
        response_type: "code",
        consent_granted: granted,
      });
      window.location.href = (response as any).redirect_uri;
    } catch (err) {
      console.error("oauthAuthorizeSubmit failed:", err);
      consentError.style.display = "block";
      consentError.textContent = "Authorization failed. Please try again.";
      btnAllow.disabled = false;
      btnDeny.disabled = false;
      btnAllow.textContent = "Allow";
    }
  }

  btnAllow.addEventListener("click", () => handleConsent(true));
  btnDeny.addEventListener("click", () => handleConsent(false));
}

// ── Route ─────────────────────────────────────────────────────────

if (isLoginPage) {
  showLogin();
} else {
  showAuthorize();
}
