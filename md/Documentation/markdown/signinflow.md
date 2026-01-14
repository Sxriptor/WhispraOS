# AMENTA IDE Sign-In Flow

## Overview

- The IDE shows a dedicated sign-in page.
- Clicking "Sign In" opens the system browser to the account site.
- The account site redirects back to a local callback server in the IDE with a token in the URL.
- The IDE saves the token and grants access.

## Flow (TL;DR)

1. User clicks “Sign In” in the IDE.
2. IDE starts a local callback server on `localhost:8080-8090`.
3. IDE opens `https://---URL---?redirect_uri=http://localhost:PORT/callback&source=ide` in the browser.
4. User authenticates on `account.--URL`.
5. Account site redirects to `http://localhost:PORT/callback?token=...&expires_at=...&refresh_token=...`.
6. IDE parses the token, stores it, and completes sign-in.

## Sign-In UI

- The sign-in page lives at `src/vs/auth/signin/signin.html`.
- The primary button triggers an Electron API to start OAuth via the external browser.
- The local callback server handles the return; the webview does not poll.

What happens on click:
- The IDE starts a loopback callback server (chooses a free port in the `8080-8090` range).
- The IDE opens the account site in the default browser with `redirect_uri` and `source=ide`.

## Local Callback Server (IDE)

- Listens for `/callback`.
- Accepts the following query params:
  - `token` (required on success)
  - `expires_at` (epoch seconds; optional, defaults to 24h)
  - `refresh_token` (optional)
  - `error` (on failures)
- Sends a success page to the user’s browser, then forwards the result to the main process and stops the server.

Parsed token fields saved by the IDE:
- `accessToken` from `token`
- `tokenType` = `Bearer`
- `expiresAt` computed from `expires_at` or a default
- Optional `refreshToken`

## Required Changes on account.---url

To return the token back to the IDE:

1. Accept a `redirect_uri` query parameter (from the IDE) when the flow starts, and keep it through the OAuth process (e.g., in `state` or session).
2. After successful authentication, redirect to that `redirect_uri` with the token info.

Example (`/auth/callback` handler), after your normal Supabase code exchange:

```javascript
// Example Express-like handler
app.get('/auth/callback', async (req, res) => {
  const { code, redirect_uri } = req.query;

  try {
    // Exchange code for session (your existing logic)
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) throw error;

    const session = data.session;

    // Check for IDE redirect
    const ideRedirect = redirect_uri || req.session?.ideRedirectUri;
    if (ideRedirect && ideRedirect.includes('localhost')) {
      const token = session.access_token;
      const expiresAt = Math.floor(new Date(session.expires_at).getTime() / 1000);
      const refreshToken = session.refresh_token; // optional

      // Redirect back to the IDE loopback server
      const url = new URL(ideRedirect);
      url.searchParams.set('token', token);
      url.searchParams.set('expires_at', String(expiresAt));
      if (refreshToken) url.searchParams.set('refresh_token', refreshToken);

      return res.redirect(url.toString());
    }

    // Standard web flow
    res.redirect('/dashboard');
  } catch (err) {
    const message = err instanceof Error ? err.message : 'auth_failed';
    const ideRedirect = redirect_uri || req.session?.ideRedirectUri;

    if (ideRedirect && ideRedirect.includes('localhost')) {
      const url = new URL(ideRedirect);
      url.searchParams.set('error', encodeURIComponent(message));
      return res.redirect(url.toString());
    }

    res.redirect(`/login?error=${encodeURIComponent(message)}`);
  }
});
```

Notes:
- Validation: only allow `redirect_uri` pointing to `localhost` or a vetted list to prevent open redirects.
- Preserve `redirect_uri` across OAuth (store in session or encode in `state`).
- Do not leak tokens to non-localhost origins.

## Testing

- Start the IDE and click “Sign In.”
- Confirm the browser opens `account.---URL` with `redirect_uri=http://localhost:PORT/callback`.
- Complete login; ensure you’re redirected to `http://localhost:PORT/callback?token=...`.
- IDE should unlock; token is stored securely.

## References (from code)

- External browser flow description:
  - `src/vs/auth/README.md` lines 11-18
- Sign-in trigger:
  - `src/vs/auth/signin/signin.html` lines 338-353
- Callback token parsing:
  - `src/vs/platform/auth/electron-main/callbackServer.ts` lines 98-146
