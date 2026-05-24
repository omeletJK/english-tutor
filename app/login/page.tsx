import { getQuickLoginEntries } from "@/lib/demo-data";
import { PaperPlane } from "@/components/illustrations";

type LoginPageProps = {
  searchParams: Promise<{
    error?: string;
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const entries = getQuickLoginEntries();
  const placeholderEmail = entries[0]?.email ?? "you@example.com";

  return (
    <main className="login-playground">
      <form className="login-card" action="/api/session" method="post">
        <div className="login-heading">
          <PaperPlane size={48} />
          <div>
            <p className="tiny-label">Omelet English</p>
            <h1>Who is reading today?</h1>
          </div>
        </div>
        <label htmlFor="email">Email</label>
        <input id="email" name="email" type="email" autoComplete="email" placeholder={placeholderEmail} />
        {params.error ? <p className="form-error">등록된 가족 이메일이 아닙니다.</p> : null}
        <button type="submit" className="quest-button">
          Start
        </button>
        <div className="quick-login" aria-label="Quick family login">
          {entries.map((entry) => (
            <button name="quickEmail" value={entry.email} type="submit" key={entry.email}>
              {entry.label}
            </button>
          ))}
        </div>
        <div className="login-hints">
          {entries.map((entry) => (
            <span key={entry.email}>{entry.email}</span>
          ))}
        </div>
      </form>
    </main>
  );
}
