import { Eye, EyeOff, LogIn } from "lucide-react";
import { useState } from "react";
import { api } from "../api/client";
import { demoAccounts } from "../api/seed";
import type { User } from "../api/types";
import { errorMessage } from "../api/useApiData";
import logo from "../assets/SAEMGIL_logo.webp";

export default function LoginPage({ onLogin }: { onLogin: (u: User) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [problem, setProblem] = useState("");
  const [busy, setBusy] = useState(false);

  function submit() {
    if (!email.trim() || !password) {
      setProblem("이메일과 비밀번호를 입력해 주세요.");
      return;
    }
    setBusy(true);
    setProblem("");
    api.auth.login(email, password).then(onLogin, (e) => {
      setProblem(errorMessage(e));
      setBusy(false);
    });
  }

  return (
    <div className="login">
      <main className="login-card">
        <img className="login-logo" src={logo} alt="SAEMGIL" />
        <h1>로그인</h1>
        <p className="login-sub">정원 관수 ROVEN 운영 서비스</p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <label>
            <span>이메일</span>
            <input
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoFocus
            />
          </label>
          <label>
            <span>비밀번호</span>
            <div className="password-field">
              <input
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "비밀번호 숨기기" : "비밀번호 보기"}
                aria-pressed={showPassword}
                title={showPassword ? "비밀번호 숨기기" : "비밀번호 보기"}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </label>
          <p className="login-problem" role="alert">
            {problem}
          </p>
          <button className="primary-button" type="submit" disabled={busy}>
            <LogIn size={16} />
            로그인
          </button>
        </form>
        <section className="login-demo">
          <h2>시연 계정</h2>
          <p>누르면 입력란이 채워집니다. 가상 서버의 예시 계정입니다.</p>
          <ul>
            {demoAccounts.map((a) => (
              <li key={a.email}>
                <button
                  type="button"
                  onClick={() => {
                    setEmail(a.email);
                    setPassword(a.password);
                    setProblem("");
                  }}
                >
                  <strong>{a.label}</strong>
                  <small>{a.email}</small>
                </button>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  );
}
