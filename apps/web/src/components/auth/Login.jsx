import React, { useState, useEffect } from "react";
import { useHistory } from "react-router-dom";
import "./login.css";
import { login, checkAuthentication, getOAuth2Config, getCsrfToken } from "services/auth";

export default function Login() {
  const history = useHistory();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [oauth2Config, setOAuth2Config] = useState({ enabled: false });

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

    checkAuth();
    loadOAuth2Config();
  }, [history]);

  const onSubmit = async (ev) => {
    ev.preventDefault();
    setError("");
    setIsSubmitting(true);
    try {
      // First attempt: Try regular login
      const resp = await login({ username, password });

      if (resp.status && resp.status < 400) {
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
        <label htmlFor="username">Username</label>
        <input
          id="username"
          type="text"
          value={username}
          onChange={(ev) => setUsername(ev.target.value)}
          autoComplete="username"
        />
        <label htmlFor="password">Password</label>
        <div className="login-password">
          <input
            id="password"
            type={isPasswordVisible ? "text" : "password"}
            value={password}
            onChange={(ev) => setPassword(ev.target.value)}
            autoComplete="current-password"
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

        {oauth2Config.enabled && oauth2Config.googleUrl && (
          <>
            <div className="login-divider">
              <span>OR</span>
            </div>
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
          </>
        )}
      </form>
    </div>
  );
}
