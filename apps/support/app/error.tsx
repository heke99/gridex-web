"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="workspace">
      <section className="panel">
        <h1>Tjänsten kunde inte laddas</h1>
        <p className="muted">
          Försök igen om en stund. Inga uppgifter har ändrats av den här
          sidvisningen.
        </p>
        <div className="actions">
          <button onClick={reset}>Försök igen</button>
          <a className="button" href="/login">
            Till inloggningen
          </a>
        </div>
      </section>
    </main>
  );
}
