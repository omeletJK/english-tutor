import { listFamilyLoginEntries } from "@/lib/auth";
import { PaperPlane } from "@/components/illustrations";

type LoginPageProps = {
  searchParams: Promise<{
    error?: string;
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const entries = await listFamilyLoginEntries();

  return (
    <main className="login-playground">
      <div className="login-aurora" aria-hidden="true">
        <span className="aurora-swirl" />
        <span className="aurora-blob aurora-blob-1" />
        <span className="aurora-blob aurora-blob-2" />
        <span className="aurora-blob aurora-blob-3" />
        <span className="aurora-blob aurora-blob-4" />
        <span className="aurora-blob aurora-blob-5" />
        <span className="aurora-blob aurora-blob-6" />
        <span className="aurora-grain" />
      </div>
      <form className="login-card" action="/api/session" method="post">
        <div className="login-heading">
          <PaperPlane size={72} />
          <div>
            <p className="tiny-label">Omelet English</p>
            <h1>Who is reading today?</h1>
          </div>
        </div>
        {params.error ? <p className="form-error">등록된 가족 사용자가 아닙니다.</p> : null}
        <div className="quick-login" aria-label="Quick family login">
          {entries.map((entry) => (
            <button name="quickEmail" value={entry.email} type="submit" key={entry.email}>
              {entry.label}
            </button>
          ))}
        </div>
      </form>
    </main>
  );
}
