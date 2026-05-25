export default function MaintenancePage() {
  return (
    <html lang="ro">
      <head>
        <title>Maphy – Mentenanță</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <style>{`
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body {
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            background: #fafafa;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            color: #18181b;
          }
          .card {
            max-width: 420px;
            width: 100%;
            padding: 2.5rem 2rem;
            border: 1px solid #e4e4e7;
            border-radius: 1.25rem;
            background: #fff;
            text-align: center;
          }
          .icon { font-size: 2.5rem; margin-bottom: 1rem; }
          h1 { font-size: 1.25rem; font-weight: 600; margin-bottom: 0.5rem; }
          p { font-size: 0.9rem; color: #52525b; line-height: 1.6; }
        `}</style>
      </head>
      <body>
        <div className="card">
          <div className="icon">🔧</div>
          <h1>Mentenanță în desfășurare</h1>
          <p>Maphy este temporar offline pentru îmbunătățiri. Revino în curând.</p>
        </div>
      </body>
    </html>
  );
}
