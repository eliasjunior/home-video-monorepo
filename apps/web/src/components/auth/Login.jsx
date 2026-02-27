import React, { useState, useEffect } from "react";
import { useHistory } from "react-router-dom";
import "./login.css";
import { login, checkAuthentication, getOAuth2Config, getNextcloudConfig, loginWithNextcloud, getCsrfToken } from "services/auth";

export default function Login() {
  const history = useHistory();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [oauth2Config, setOAuth2Config] = useState({ enabled: false });
  const [nextcloudConfig, setNextcloudConfig] = useState({ enabled: false });
  const [isNextcloudMode, setIsNextcloudMode] = useState(false);
  const [showAppPasswordHelp, setShowAppPasswordHelp] = useState(false);
  const [showNextcloudInfoHelp, setShowNextcloudInfoHelp] = useState(false);

  // Check if user is already authenticated and load OAuth2 config on component mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const result = await checkAuthentication();
        if (result.authenticated) {
          // User is already authenticated, redirect to home
          history.push("/");
        }
      } catch (err) {
        // If check fails, just show login form
        console.error("Auth check failed:", err);
      } finally {
        setIsCheckingAuth(false);
      }
    };

    const loadOAuth2Config = async () => {
      try {
        const config = await getOAuth2Config();
        setOAuth2Config(config);
      } catch (err) {
        console.error("Failed to load OAuth2 config:", err);
      }
    };

    const loadNextcloudConfig = async () => {
      try {
        const config = await getNextcloudConfig();
        console.log("[Login] Nextcloud config loaded:", config);
        setNextcloudConfig(config);
      } catch (err) {
        console.error("Failed to load Nextcloud config:", err);
      }
    };

    checkAuth();
    loadOAuth2Config();
    loadNextcloudConfig();
  }, [history]);

  const onSubmit = async (ev) => {
    ev.preventDefault();
    setError("");
    setIsSubmitting(true);
    try {
      // Check if Nextcloud mode
      if (isNextcloudMode) {
        const resp = await loginWithNextcloud({ username, appPassword: password });

        if (resp.status && resp.status < 400) {
          // Store Nextcloud credentials for fetching shares
          sessionStorage.setItem('nextcloud_username', username);
          sessionStorage.setItem('nextcloud_app_password', password);
          sessionStorage.setItem('nextcloud_auth_enabled', 'true');

          history.push("/");
          return;
        }

        setError(resp.message || "Invalid Nextcloud credentials");
        return;
      }

      // First attempt: Try regular login
      const resp = await login({ username, password });

      if (resp.status && resp.status < 400) {
        // Check if Nextcloud is available for this user
        if (resp.nextcloudAvailable && resp.nextcloudCredentials) {
          console.log('[Login] User has Nextcloud access, storing credentials');
          sessionStorage.setItem('nextcloud_username', resp.nextcloudCredentials.username);
          sessionStorage.setItem('nextcloud_app_password', resp.nextcloudCredentials.password);
          sessionStorage.setItem('nextcloud_auth_enabled', 'true');
        } else {
          console.log('[Login] User does not have Nextcloud access');
        }

        history.push("/");
        return;
      }

      // If first login fails with 401, try second login with external auth
      const loginSecondRetry = process.env.REACT_APP_LOGIN_SECOND_RETRY === 'true';
      const loginSecondRetryUrl = process.env.REACT_APP_LOGIN_SECOND_RETRY_URL;

      if (resp.status === 401 && loginSecondRetry && loginSecondRetryUrl) {
        console.log("[LOGIN] First login failed, attempting second retry with external auth");

        // Extract base URL from loginSecondRetryUrl (e.g., http://host.docker.internal:8080/api/authenticate -> http://host.docker.internal:8080/api)
        const baseUrl = loginSecondRetryUrl.substring(0, loginSecondRetryUrl.lastIndexOf('/'));
        const csrfUrl = `${baseUrl}/csrf`;

        console.log("[LOGIN] Fetching CSRF token from:", csrfUrl);

        // Get CSRF token from external API
        const csrfResponse = await fetch(csrfUrl, {
          method: "GET",
          credentials: "include",
        });

        if (!csrfResponse.ok) {
          console.log("[LOGIN] Failed to fetch CSRF token");
          setError("Authentication service unavailable");
          return;
        }

        const csrfData = await csrfResponse.json();
        const csrfToken = csrfData.token;
        const csrfHeaderName = csrfData.headerName || "X-XSRF-TOKEN";

        console.log("[LOGIN] Got CSRF token, header name:", csrfHeaderName);

        // Prepare form data
        const formData = new URLSearchParams();
        formData.append("username", username);
        formData.append("password", password);

        // Call external authentication endpoint
        const authResponse = await fetch(loginSecondRetryUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
            [csrfHeaderName]: csrfToken,
          },
          body: formData.toString(),
          credentials: "include",
        });

        if (authResponse.ok) {
          const authData = await authResponse.json();
          if (authData.tokenValue) {
            console.log("[LOGIN] Second retry successful, redirecting to home");
            history.push("/");
            return;
          }
        }

        console.log("[LOGIN] Second retry failed");
        setError("Invalid credentials");
      } else {
        setError(resp.message || "Invalid credentials");
      }
    } catch (err) {
      console.error("[LOGIN] Error during login:", err);
      setError("Login failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Show loading state while checking authentication
  if (isCheckingAuth) {
    return (
      <div className="login">
        <div className="login-card">
          <p>Checking authentication...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="login">
      <form className="login-card" onSubmit={onSubmit}>
        <h1>Sign in</h1>

        {nextcloudConfig.enabled && nextcloudConfig.appPasswordEnabled && (
          <div style={{ marginBottom: "15px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
              <label style={{ display: "flex", alignItems: "center", cursor: "pointer", margin: 0 }}>
                <input
                  type="checkbox"
                  checked={isNextcloudMode}
                  onChange={(e) => setIsNextcloudMode(e.target.checked)}
                  style={{ marginRight: "8px" }}
                />
                Use Nextcloud App Password
              </label>
              <button
                type="button"
                onClick={() => setShowNextcloudInfoHelp(true)}
                title="What is Nextcloud integration?"
                style={{
                  padding: "0",
                  fontSize: "14px",
                  background: "transparent",
                  border: "1px solid #0082c9",
                  borderRadius: "50%",
                  cursor: "pointer",
                  color: "#0082c9",
                  fontWeight: "bold",
                  width: "20px",
                  height: "20px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center"
                }}
              >
                ?
              </button>
            </div>
            <button
              type="button"
              onClick={() => setShowAppPasswordHelp(true)}
              style={{
                marginTop: "5px",
                padding: "4px 8px",
                fontSize: "12px",
                background: "transparent",
                border: "1px solid #ccc",
                borderRadius: "4px",
                cursor: "pointer",
                color: "#666"
              }}
            >
              How to generate app password?
            </button>
          </div>
        )}

        <label htmlFor="username">Username</label>
        <input
          id="username"
          type="text"
          value={username}
          onChange={(ev) => setUsername(ev.target.value)}
          autoComplete="username"
        />
        <label htmlFor="password">
          {isNextcloudMode ? "Nextcloud App Password" : "Password"}
        </label>
        <div className="login-password">
          <input
            id="password"
            type={isPasswordVisible ? "text" : "password"}
            value={password}
            onChange={(ev) => setPassword(ev.target.value)}
            autoComplete={isNextcloudMode ? "off" : "current-password"}
          />
          <button
            type="button"
            className="login-reveal"
            onClick={() => setIsPasswordVisible(!isPasswordVisible)}
          >
            {isPasswordVisible ? "Hide" : "Show"}
          </button>
        </div>
        {error ? <div className="login-error">{error}</div> : null}
        <button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Signing in..." : "Sign in"}
        </button>

        {(oauth2Config.enabled && oauth2Config.googleUrl) || (nextcloudConfig.enabled && nextcloudConfig.ssoEnabled) ? (
          <>
            <div className="login-divider">
              <span>OR</span>
            </div>

            {oauth2Config.enabled && oauth2Config.googleUrl && (
              <a
                href={oauth2Config.googleUrl}
                className="login-google-button"
              >
                <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
                  <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#4285F4"/>
                  <path d="M9.003 18c2.43 0 4.467-.806 5.956-2.18L12.05 13.56c-.806.54-1.836.86-3.047.86-2.344 0-4.328-1.584-5.036-3.711H.96v2.332C2.44 15.983 5.485 18 9.003 18z" fill="#34A853"/>
                  <path d="M3.964 10.712c-.18-.54-.282-1.117-.282-1.71 0-.593.102-1.17.282-1.71V4.96H.957C.347 6.175 0 7.55 0 9.002c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
                  <path d="M9.003 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.464.891 11.426 0 9.003 0 5.485 0 2.44 2.017.96 4.958L3.967 7.29c.708-2.127 2.692-3.71 5.036-3.71z" fill="#EA4335"/>
                </svg>
                Sign in with Google
              </a>
            )}

            {nextcloudConfig.enabled && nextcloudConfig.ssoEnabled && nextcloudConfig.ssoUrl && (
              <a
                href={nextcloudConfig.ssoUrl}
                className="login-google-button"
                style={{ marginTop: "10px", background: "#0082c9" }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="white">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
                </svg>
                Sign in with Nextcloud SSO
              </a>
            )}
          </>
        ) : null}
      </form>

      {/* App Password Help Modal */}
      {showAppPasswordHelp && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0, 0, 0, 0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
          onClick={() => setShowAppPasswordHelp(false)}
        >
          <div
            style={{
              background: "white",
              padding: "30px",
              borderRadius: "8px",
              maxWidth: "600px",
              maxHeight: "80vh",
              overflow: "auto",
              boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ marginTop: 0, color: "#333" }}>How to Generate a Nextcloud App Password</h2>

            <div style={{ lineHeight: "1.6", color: "#555" }}>
              <p>Nextcloud App Passwords are secure tokens that allow third-party applications to access your Nextcloud account without exposing your actual password.</p>

              <h3 style={{ color: "#0082c9", marginTop: "20px" }}>Steps:</h3>
              <ol style={{ paddingLeft: "20px" }}>
                <li style={{ marginBottom: "10px" }}>
                  <strong>Login to Nextcloud</strong><br />
                  Go to <a href={nextcloudConfig.url || "https://spendingbetter.com/nextcloud"} target="_blank" rel="noopener noreferrer" style={{ color: "#0082c9" }}>
                    {nextcloudConfig.url || "your Nextcloud instance"}
                  </a>
                </li>
                <li style={{ marginBottom: "10px" }}>
                  <strong>Open Settings</strong><br />
                  Click your profile picture/avatar in the top right → Select <strong>&quot;Personal settings&quot;</strong>
                </li>
                <li style={{ marginBottom: "10px" }}>
                  <strong>Navigate to Security</strong><br />
                  In the left sidebar, click on <strong>&quot;Security&quot;</strong>
                </li>
                <li style={{ marginBottom: "10px" }}>
                  <strong>Find &quot;Devices &amp; sessions&quot; section</strong><br />
                  Scroll down to the &quot;Devices &amp; sessions&quot; or &quot;App passwords&quot; section
                </li>
                <li style={{ marginBottom: "10px" }}>
                  <strong>Create new app password</strong><br />
                  • Enter a name (e.g., &quot;Home Video App&quot;)<br />
                  • Click <strong>&quot;Create new app password&quot;</strong><br />
                  • Copy the generated password (format: <code style={{ background: "#f4f4f4", padding: "2px 6px", borderRadius: "3px" }}>xxxxx-xxxxx-xxxxx-xxxxx</code>)
                </li>
                <li style={{ marginBottom: "10px" }}>
                  <strong>Use the app password to login</strong><br />
                  Paste the copied password in the login form when &quot;Use Nextcloud App Password&quot; is checked
                </li>
              </ol>

              <div style={{ background: "#fff3cd", border: "1px solid #ffc107", padding: "15px", borderRadius: "4px", marginTop: "20px" }}>
                <strong>⚠️ Important:</strong>
                <ul style={{ marginTop: "10px", marginBottom: 0, paddingLeft: "20px" }}>
                  <li>App passwords are typically 72+ characters long</li>
                  <li>Do NOT use your regular Nextcloud password</li>
                  <li>Each app/device should have its own app password</li>
                  <li>You can revoke app passwords anytime from Nextcloud settings</li>
                </ul>
              </div>
            </div>

            <button
              onClick={() => setShowAppPasswordHelp(false)}
              style={{
                marginTop: "20px",
                padding: "10px 20px",
                background: "#0082c9",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
                fontSize: "14px",
                width: "100%",
              }}
            >
              Got it!
            </button>
          </div>
        </div>
      )}

      {/* Nextcloud Info Help Modal */}
      {showNextcloudInfoHelp && (
        <div onClick={() => setShowNextcloudInfoHelp(false)} style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: "white", padding: "30px", borderRadius: "8px", maxWidth: "600px", maxHeight: "80vh", overflow: "auto" }}>
            <h2 style={{ marginTop: 0, color: "#333" }}>What is Nextcloud Integration?</h2>

            <p style={{ lineHeight: "1.6", color: "#555" }}>
              The Nextcloud integration allows you to <strong>stream video files that are shared with you in Nextcloud</strong> directly in this Home Video application, without having to download them locally.
            </p>

            <h3 style={{ marginTop: "20px", color: "#333" }}>How It Works:</h3>
            <ol style={{ lineHeight: "1.8", color: "#555" }}>
              <li>Other Nextcloud users share video files with you</li>
              <li>You login with your Nextcloud credentials (using an app password)</li>
              <li>Videos shared with you appear in your dashboard alongside local videos</li>
              <li>Click any shared video to stream it directly from Nextcloud</li>
            </ol>

            <h3 style={{ marginTop: "20px", color: "#333" }}>How to Share Videos in Nextcloud:</h3>
            <ol style={{ lineHeight: "1.8", color: "#555" }}>
              <li>
                <strong>Login to Nextcloud</strong><br />
                Go to <a href={nextcloudConfig.url || "https://spendingbetter.com/nextcloud"} target="_blank" rel="noopener noreferrer" style={{ color: "#0082c9" }}>
                  {nextcloudConfig.url || "your Nextcloud instance"}
                </a>
              </li>
              <li>
                <strong>Upload your video files</strong><br />
                Upload video files (MP4, MKV, AVI, etc.) to any folder in Nextcloud
              </li>
              <li>
                <strong>Share the video files</strong><br />
                • Right-click on a video file or folder<br />
                • Click &quot;Share&quot; or the share icon<br />
                • Enter the username or email of the person you want to share with<br />
                • Click &quot;Share&quot; to confirm
              </li>
              <li>
                <strong>The recipient can now see the videos</strong><br />
                Once shared, the recipient can login to this Home Video app with their Nextcloud credentials and see the shared videos
              </li>
            </ol>

            <div style={{ background: "#e7f3ff", border: "1px solid #0082c9", padding: "15px", borderRadius: "4px", marginTop: "20px" }}>
              <strong>💡 Tip:</strong>
              <ul style={{ marginTop: "10px", marginBottom: 0, paddingLeft: "20px" }}>
                <li>You can share individual video files or entire folders</li>
                <li>Only video files shared <strong>with you</strong> will appear in the app</li>
                <li>You need an app password to login (not your regular Nextcloud password)</li>
                <li>Videos are streamed directly - no need to download them</li>
              </ul>
            </div>

            <button
              onClick={() => setShowNextcloudInfoHelp(false)}
              style={{
                marginTop: "20px",
                padding: "10px 20px",
                background: "#0082c9",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
                fontSize: "14px",
                width: "100%",
              }}
            >
              Got it!
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
