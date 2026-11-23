import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../../hooks/useAuth';

export default function LoginPage() {
  const navigate = useNavigate();
  const { status, error: authError, signInWithPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const isConfigured = status !== 'UNCONFIGURED';

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting || !isConfigured) return;

    setIsSubmitting(true);
    setSubmitError(null);
    try {
      await signInWithPassword(email.trim(), password);
      setPassword('');
      navigate('/', { replace: true });
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : '로그인하지 못했습니다. 다시 시도해 주세요.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="auth-page" aria-labelledby="login-title">
      <section className="auth-card">
        <p className="page-eyebrow">LIFELOG DIARY</p>
        <h1 id="login-title">로그인</h1>
        <p className="auth-card__description">이메일과 비밀번호로 계정에 로그인하세요.</p>

        {status === 'UNCONFIGURED' && (
          <p className="settings-feedback settings-feedback--error" role="alert">
            Supabase URL과 공개 Auth Key 설정이 필요합니다.
          </p>
        )}
        {(submitError || (!submitError && authError)) && (
          <p className="settings-feedback settings-feedback--error" role="alert">
            {submitError ?? authError}
          </p>
        )}

        <form className="auth-form" onSubmit={(event) => { void handleSubmit(event); }}>
          <label htmlFor="login-email">이메일</label>
          <input
            autoComplete="email"
            disabled={isSubmitting || !isConfigured}
            id="login-email"
            name="email"
            onChange={(event) => setEmail(event.target.value)}
            required
            type="email"
            value={email}
          />

          <label htmlFor="login-password">비밀번호</label>
          <input
            autoComplete="current-password"
            disabled={isSubmitting || !isConfigured}
            id="login-password"
            name="password"
            onChange={(event) => setPassword(event.target.value)}
            required
            type="password"
            value={password}
          />

          <button className="auth-submit" disabled={isSubmitting || !isConfigured} type="submit">
            {isSubmitting ? '로그인 중...' : '로그인'}
          </button>
        </form>
      </section>
    </main>
  );
}
