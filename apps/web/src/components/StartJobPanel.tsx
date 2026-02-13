import { useState, type FormEvent } from 'react';

export function StartJobPanel() {
  const [startUrl, setStartUrl] = useState('');
  const [message, setMessage] = useState('');

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!startUrl.trim()) {
      setMessage('Please provide a starting URL.');
      return;
    }

    setMessage('Job orchestration is next. URL captured successfully for v1 step 1.');
  }

  return (
    <section>
      <h2>Start Job</h2>
      <p>Enter a starting URL. Profile selection is now available in Profile Manager. Crawl execution will be added in next steps.</p>
      <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '0.5rem', maxWidth: '640px' }}>
        <input
          type="url"
          placeholder="https://example.com/content/chapter-1"
          value={startUrl}
          onChange={(event) => setStartUrl(event.target.value)}
          style={{ flex: 1 }}
        />
        <button type="submit">Validate URL</button>
      </form>
      {message && <p>{message}</p>}
    </section>
  );
}
