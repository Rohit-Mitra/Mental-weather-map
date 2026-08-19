/**
 * The slide-in forecast for one state.
 *
 * The readings block is the reason to open this panel at all. A single number
 * and a rank do not tell you much; what does is whether the reading is unusual
 * *for this state*, which way it has been moving and for how long, how it sits
 * against the rest of the country, and which search term is actually carrying
 * it. "Exam stress is high in May" is not a finding — "exam stress here is 18
 * points above the national level for the same term" is.
 */
import React, { useEffect, useRef } from 'react';
import TrendChart from './TrendChart.jsx';
import WeatherIcon from './WeatherIcon.jsx';
import { TIER_ACCENT, colorFor, formatWeek } from '../lib/stormIndex.js';
import { contextNote, ordinal, stateInsights } from '../lib/narrative.js';

const DEVANAGARI = /[ऀ-ॿ]/;

function Reading({ label, value, detail, tone }) {
  return (
    <div className={`reading-row ${tone ? `reading-row--${tone}` : ''}`}>
      <dt>{label}</dt>
      <dd>
        <span className="reading-row__value">{value}</span>
        {detail && <span className="reading-row__detail">{detail}</span>}
      </dd>
    </div>
  );
}

function signed(n) {
  if (n === 0) return 'no change';
  return `${n > 0 ? '+' : '−'}${Math.abs(n)}`;
}

export default function StateDetailPanel({ data, state, viewMode, weekIndex, termMeans, onClose }) {
  const closeRef = useRef(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, state?.code]);

  if (!state) return null;

  const insights = stateInsights(data, state, viewMode, weekIndex, termMeans);
  const { tier } = insights;
  const accent = TIER_ACCENT[tier.key];
  const week = state.history[weekIndex]?.week ?? state.current.week;
  const rising = state.rising_queries ?? [];
  const labels = data.meta.term_labels ?? {};

  return (
    <aside
      className="panel"
      style={{ '--accent': accent }}
      role="dialog"
      aria-modal="false"
      aria-label={`Forecast detail for ${state.name}`}
    >
      <div className="panel__top">
        <div>
          <h2 className="panel__state">{state.name}</h2>
          <p className="panel__sub">
            {viewMode === 'outlook'
              ? '12-month outlook · average of the last 52 weeks'
              : `Current conditions · week of ${formatWeek(week)}`}
          </p>
        </div>
        <button ref={closeRef} type="button" className="panel__close" onClick={onClose} aria-label="Close forecast detail">
          ×
        </button>
      </div>

      <div className="panel__hero">
        <WeatherIcon tier={tier.key} size={56} className="panel__icon" />
        <div className="panel__reading">
          <div className="panel__number" style={{ color: colorFor(insights.index) }}>
            {insights.index}
          </div>
          <div className="panel__band">
            <span className="panel__level">{tier.level}</span>
            <span className="panel__tier">{tier.label}</span>
          </div>
        </div>
        <div className="panel__chips">
          {viewMode === 'current' && (
            <span className={`chip chip--${insights.delta > 0 ? 'up' : insights.delta < 0 ? 'down' : 'flat'}`}>
              {insights.delta > 0 ? '▲' : insights.delta < 0 ? '▼' : '■'}{' '}
              {insights.delta === 0 ? 'steady' : `${Math.abs(insights.delta)} this week`}
            </span>
          )}
          <span className="chip">{ordinal(insights.rank)} of {insights.total}</span>
        </div>
      </div>

      <p className="panel__note">{contextNote(insights, viewMode)}</p>

      <section className="panel__section">
        <h3 className="panel__h3">Forecast history</h3>
        <p className="panel__hint">Storm Index over the last 12 months. Hover to scrub.</p>
        <TrendChart history={state.history} markerIndex={weekIndex} accent={accent} />
      </section>

      <section className="panel__section">
        <h3 className="panel__h3">Readings</h3>
        <dl className="readings">
          <Reading
            label="vs all-India"
            value={signed(insights.vsNational)}
            detail={`all-India is ${insights.national}`}
            tone={insights.vsNational > 0 ? 'up' : insights.vsNational < 0 ? 'down' : undefined}
          />
          {insights.change4w !== null && (
            <Reading
              label="4-week change"
              value={signed(insights.change4w)}
              detail={insights.change4w > 0 ? 'building' : insights.change4w < 0 ? 'easing' : 'flat'}
              tone={insights.change4w > 0 ? 'up' : insights.change4w < 0 ? 'down' : undefined}
            />
          )}
          {insights.streak && (
            <Reading
              label="Run"
              value={`${insights.streak.weeks} ${insights.streak.weeks === 1 ? 'week' : 'weeks'}`}
              detail={insights.streak.direction}
              tone={insights.streak.direction === 'rising' ? 'up' : 'down'}
            />
          )}
          <Reading
            label="Year’s peak"
            value={insights.peak.storm_index}
            detail={`week of ${formatWeek(insights.peak.week, { year: false })}`}
          />
          {insights.leading && (
            <Reading
              label="Driven by"
              value={labels[insights.leading.term] ?? insights.leading.term}
              detail={
                insights.leading.lift > 0
                  ? `${insights.leading.lift} above the national level for that term`
                  : 'no term stands out here'
              }
            />
          )}
        </dl>
      </section>

      <section className="panel__section">
        <h3 className="panel__h3">What’s brewing</h3>
        {rising.length > 0 ? (
          <>
            <p className="panel__hint">Related searches rising fastest here.</p>
            <ul className="brewing">
              {rising.slice(0, 3).map((q) => (
                <li key={q.query} className="brewing__chip">
                  <span className={`brewing__text ${DEVANAGARI.test(q.plain || q.query) ? 'is-deva' : ''}`}>
                    {q.plain || q.query}
                  </span>
                  <span className="brewing__delta">{q.formatted}</span>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="panel__hint">No rising searches reported for this state.</p>
        )}
      </section>

      <section className="panel__section">
        <h3 className="panel__h3">What goes into the index</h3>
        <p className="panel__hint">Relative search interest for each tracked term, latest week.</p>
        <ul className="signal-mix">
          {data.meta.terms.map((term) => {
            const value = state.current.term_scores?.[term] ?? 0;
            const label = labels[term] ?? term;
            return (
              <li key={term} className="signal-mix__row">
                <span className={`signal-mix__term ${DEVANAGARI.test(label) ? 'is-deva' : ''}`}>
                  {label}
                </span>
                <span className="signal-mix__bar">
                  <span className="signal-mix__fill" style={{ width: `${value}%` }} />
                </span>
                <span className="signal-mix__value">{value}</span>
              </li>
            );
          })}
        </ul>
      </section>

      <p className="panel__footnote">
        These are counts of searches, not of people, and not a measure of anyone’s health.
      </p>
    </aside>
  );
}
