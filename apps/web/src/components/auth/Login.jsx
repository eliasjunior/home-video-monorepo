import React, { useState } from "react";
import { useHistory } from "react-router-dom";
import "./login.css";
import { login } from "services/auth";

export default function Login() {
  const history = useHistory();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);

  const onSubmit = async (ev) => {
    ev.preventDefault();
    setError("");
    setIsSubmitting(true);
    try {
      const resp = await login({ username, password });
      if (resp.status && resp.status < 400) {
        history.push("/");
      } else {
        setError(resp.message || "Invalid credentials");
      }
    } catch (err) {
      setError("Login failed");
    } finally {
      setIsSubmitting(false);
    }
  };

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
      </form>
    </div>
  );
}
