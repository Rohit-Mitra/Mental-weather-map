/**
 * The persistent disclaimer. Deliberately always on screen rather than hidden
 * behind the info button — the topic is sensitive enough that a viewer should
 * never see the map without also seeing this.
 */
import React from 'react';

export default function Disclaimer({ onAbout }) {
  return (
    <footer className="disclaimer">
      <p className="disclaimer__text">
        <svg className="disclaimer__mark" viewBox="0 0 16 16" width="13" height="13" aria-hidden="true" focusable="false">
          <circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" strokeWidth="1.4" />
          <circle cx="8" cy="4.4" r="1" fill="currentColor" />
          <rect x="7.15" y="6.6" width="1.7" height="5.4" rx="0.85" fill="currentColor" />
        </svg>
        This map visualizes aggregated, anonymized public search-trend data as a general proxy
        signal. It is <strong>not a clinical or diagnostic tool</strong> and does not represent
        individual mental health data. If you or someone you know is struggling, please reach out to
        a mental health professional or a helpline.
      </p>
      <div className="disclaimer__actions">
        <a className="disclaimer__link" href="tel:14416">
          Tele-MANAS 14416
        </a>
        <button type="button" className="disclaimer__btn" onClick={onAbout}>
          About the data
        </button>
      </div>
    </footer>
  );
}
