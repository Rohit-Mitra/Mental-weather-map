/**
 * "About the Data" — the honest explanation, in plain language.
 *
 * A visualization that puts monsoon-warning imagery on a mental-health signal
 * has an obligation to say clearly what the signal is and is not. Everything a
 * viewer needs to judge the map lives here: what search-trend data measures, why
 * it is a proxy and not a diagnosis, which parts of India it under-represents,
 * that no individual data exists in it, where it came from, and how the number
 * was computed.
 */
import React, { useEffect, useRef } from 'react';
import { TIERS, colorFor } from '../lib/stormIndex.js';

const DEVANAGARI = /[ऀ-ॿ]/;

export default function AboutModal({ meta, loadedFrom, onClose }) {
  const closeRef = useRef(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  const generated = meta.generated_at
    ? new Date(meta.generated_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
    : 'unknown';
  const labels = meta.term_labels ?? {};

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="about-title">
        <div className="modal__head">
          <h2 id="about-title" className="modal__title">About the data</h2>
          <button ref={closeRef} type="button" className="modal__close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <div className="modal__body">
          {meta.is_synthetic && (
            <div className="modal__alert">
              <strong>You are looking at simulated data.</strong> The dataset currently loaded was
              produced by a random-number generator so this demo runs offline with no API keys. It
              models realistic seasonal and regional patterns for India, but it is not a measurement
              and describes no real population. Nothing on this screen is a finding about any real
              place.
            </div>
          )}

          <section>
            <h3>What you are looking at</h3>
            <p>
              This is a weather map of <em>search behaviour</em>. Each state and union territory is
              shaded and animated by a single number we call the <strong>Storm Index</strong>: how
              much people there have been searching a fixed set of everyday stress and anxiety
              phrases, compared with everywhere else in India and with the rest of the year. Clear
              skies mean relatively little of that searching. Storms mean a lot of it.
            </p>
          </section>

          <section>
            <h3>Why the colours look like a monsoon bulletin</h3>
            <p>
              The bands use the India Meteorological Department’s warning ladder, because it is a
              scale most people in India can already read at a glance. Green is no warning, yellow
              means watch, orange means alert, red means warning. They describe how unusual the
              searching is — nothing more.
            </p>
            <ul className="modal__tiers">
              {TIERS.map((t) => (
                <li key={t.key}>
                  <span className="modal__tier-chip" style={{ background: colorFor((t.min + t.max) / 2) }} />
                  <span className="modal__tier-label">{t.label}</span>
                  <span className="modal__tier-level">{t.code} · {t.level}</span>
                  <span className="modal__tier-range">{t.min}–{t.max}</span>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h3>What search-trend data actually is</h3>
            <p>
              Google Trends reports <em>relative search interest</em>: for a given term and place, it
              scales how common that search was against total searches from that place, then puts it
              on a 0–100 scale where 100 is the busiest point observed. It is not a count of people
              and not a count of searches. A state at 80 is not “80% anxious” — it means stress-term
              searching there was high relative to the rest of the map.
            </p>
          </section>

          <section>
            <h3>Why this is a proxy, not a diagnosis</h3>
            <p>
              Searching “can’t sleep” at 3am is a signal, but a noisy one. People search out of
              worry, curiosity, for a friend, for homework, or because a film or a news story used
              the phrase. A spike means <em>more searching</em>, which may or may not track more
              distress.
            </p>
            <p className="modal__emphasis">
              This map cannot diagnose anyone, cannot measure anyone’s health, and should never be
              used to make a decision about a person, a workplace or a community.
            </p>
          </section>

          <section>
            <h3>What it under-represents in India</h3>
            <p>
              Internet and smartphone access is far from even across Indian states, and it skews
              urban, younger and male. People search in many languages and in Hinglish, so a basket
              of terms can only ever catch part of the picture — this one tracks English phrasings
              plus Hindi, which leaves large parts of the country under-counted. States where fewer
              people search at all will look calmer here regardless of what is happening. Read a
              green state as “we have little signal”, not as “all is well”.
            </p>
          </section>

          <section>
            <h3>There is no individual data here</h3>
            <p>
              By construction, every figure is a regional aggregate. Google Trends only ever
              publishes anonymized, aggregated, normalized data — individual searches, accounts and
              identities are never exposed by the source, and nothing in this project collects,
              stores or infers anything about a person. The smallest unit anywhere in this app is a
              whole state or union territory.
            </p>
          </section>

          <section>
            <h3>How the Storm Index is calculated</h3>
            <p>
              We track {meta.terms.length} search terms:{' '}
              {meta.terms.map((t, i) => (
                <React.Fragment key={t}>
                  {i > 0 && ', '}
                  <span className={`modal__term ${DEVANAGARI.test(labels[t] ?? t) ? 'is-deva' : ''}`}>
                    {labels[t] ?? t}
                  </span>
                </React.Fragment>
              ))}
              . For each state and week we take a weighted average of their regional search interest
              — acute phrasings like “panic attack” count slightly more, help-seeking phrasings like
              “psychiatrist near me” slightly less — then rescale everything onto 0–100 so states and
              weeks are comparable.
            </p>
          </section>

          <section>
            <h3>Source and provenance</h3>
            <dl className="modal__meta">
              <dt>Data source</dt>
              <dd>
                {meta.is_synthetic ? (
                  <>Synthetic generator (<code>data/generate_mock_data.py</code>), modelled on the shape of{' '}
                  <a href="https://trends.google.com/trends/" target="_blank" rel="noopener noreferrer">Google Trends</a> data</>
                ) : (
                  <a href="https://trends.google.com/trends/" target="_blank" rel="noopener noreferrer">
                    Google Trends — Interest by Region, India
                  </a>
                )}
              </dd>
              <dt>Coverage</dt>
              <dd>
                28 states and 8 union territories · {meta.timeframe.weeks} weekly points ·{' '}
                {meta.timeframe.start} to {meta.timeframe.end}
              </dd>
              <dt>Boundaries</dt>
              <dd>District boundaries dissolved to states; shown as conventionally depicted within India</dd>
              <dt>Dataset generated</dt>
              <dd>{generated}</dd>
              <dt>Loaded from</dt>
              <dd>{loadedFrom === 'bundle' ? 'bundled fallback copy' : 'data/trends_data.json'}</dd>
            </dl>
            {Array.isArray(meta.notes) && meta.notes.length > 0 && (
              <ul className="modal__notes">
                {meta.notes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            )}
          </section>

          <section className="modal__help">
            <h3>If you need support</h3>
            <p>
              This is a data visualization, not a service. If you or someone you know is struggling,
              please talk to a mental health professional or contact a helpline.
            </p>
            <ul>
              <li>
                <strong>Tele-MANAS</strong> — call <strong>14416</strong> or 1-800-891-4416, free and
                24×7, Government of India
              </li>
              <li>
                <strong>KIRAN</strong> — <strong>1800-599-0019</strong>, 24×7, 13 languages
              </li>
              <li>
                <strong>Vandrevala Foundation</strong> — <strong>9999 666 555</strong>, 24×7
              </li>
              <li>
                <strong>iCall</strong> — <strong>9152987821</strong>, Mon–Sat, 10am–8pm
              </li>
              <li>
                <strong>Outside India:</strong>{' '}
                <a href="https://findahelpline.com" target="_blank" rel="noopener noreferrer">
                  findahelpline.com
                </a>
              </li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
