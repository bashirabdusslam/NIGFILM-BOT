import React from "react";

const LEGAL_PAGES = {
  terms: {
    title: "Terms of Service",
    subtitle: "Rules for using NIGFILM",
  },
  copyright: {
    title: "Copyright Policy",
    subtitle: "Our copyright policy",
  },
  rights: {
    title: "Rights & Ownership Declaration",
    subtitle: "Statement of rights and distribution authorization",
  },
  complaint: {
    title: "Copyright Complaint Process",
    subtitle: "How to submit a copyright complaint",
  },
  takedown: {
    title: "Takedown Request",
    subtitle: "Request removal of content from NIGFILM",
  },
};

function PublicHeader({
  page,
  setPage,
  onLogin,
  onRegister,
}) {
  return (
    <header className="public-header">
      <button
        type="button"
        className="public-brand"
        onClick={() => setPage("landing")}
      >
        NIG<span>FILM</span>
      </button>

      <nav className="public-nav">
        <button
          type="button"
          className={page === "landing" ? "active" : ""}
          onClick={() => setPage("landing")}
        >
          Home
        </button>

        <button
          type="button"
          onClick={() => setPage("terms")}
        >
          Terms
        </button>

        <button
          type="button"
          onClick={() => setPage("copyright")}
        >
          Copyright
        </button>

        <button
          type="button"
          onClick={onLogin}
        >
          Login
        </button>

        <button
          type="button"
          className="public-cta"
          onClick={onRegister}
        >
          Create Account
        </button>
      </nav>
    </header>
  );
}

function PublicFooter({ setPage }) {
  return (
    <footer className="public-footer">
      <div className="public-footer-brand">
        <strong>
          NIG<span>FILM</span>
        </strong>

        <p>
          Movies at your fingertips.
          NIGFILM provides a simple digital platform for discovering and watching entertainment content.
        </p>
      </div>

      <div className="public-footer-links">
        <button
          type="button"
          onClick={() => setPage("terms")}
        >
          Terms of Service
        </button>

        <button
          type="button"
          onClick={() => setPage("copyright")}
        >
          Copyright Policy
        </button>

        <button
          type="button"
          onClick={() => setPage("rights")}
        >
          Rights & Ownership
        </button>

        <button
          type="button"
          onClick={() => setPage("complaint")}
        >
          Copyright Complaint
        </button>

        <button
          type="button"
          onClick={() => setPage("takedown")}
        >
          Request Takedown
        </button>
      </div>

      <p className="public-footer-copy">
        © {new Date().getFullYear()} NIGFILM.
        All rights reserved.
      </p>
    </footer>
  );
}

function LandingPage({
  setPage,
  onLogin,
  onRegister,
}) {
  return (
    <main className="public-main">
      <section className="public-hero">
        <div className="public-hero-content">
          <p className="public-eyebrow">
            HAUSA • DUBBED • MOVIES • SERIES
          </p>

          <h1>
            Premium entertainment,
            <span> wherever you are.</span>
          </h1>

          <p className="public-hero-description">
            NIGFILM is a digital entertainment platform for discovering and watching Hausa movies, Hausa-dubbed films, series, and other available entertainment content.
          </p>

          <div className="public-hero-actions">
            <button
              type="button"
              className="public-primary-button"
              onClick={onRegister}
            >
              Get Started with NIGFILM
            </button>

            <button
              type="button"
              className="public-secondary-button"
              onClick={onLogin}
            >
              Login
            </button>
          </div>
        </div>
      </section>

      <section className="public-section">
        <div className="public-section-heading">
          <p>DISCOVER NIGFILM</p>

          <h2>
            Movies and entertainment in one place
          </h2>

          <span>
            Discover new movies, categories, and studios with ease.
          </span>
        </div>

        <div className="public-feature-grid">
          <article>
            <span className="public-feature-icon">
              🎬
            </span>

            <h3>Browse Movies</h3>

            <p>
              Browse movies by category, studio, or title.
            </p>
          </article>

          <article>
            <span className="public-feature-icon">
              ▶
            </span>

            <h3>Stream Online</h3>

            <p>
              Stream content you have access to directly on NIGFILM.
            </p>
          </article>

          <article>
            <span className="public-feature-icon">
              🏢
            </span>

            <h3>Studios</h3>

            <p>
              Discover movies by studio or the company associated with the content.
            </p>
          </article>

          <article>
            <span className="public-feature-icon">
              🔐
            </span>

            <h3>Secure Access</h3>

            <p>
              Your account helps you manage purchases and your movie library.
            </p>
          </article>
        </div>
      </section>

      <section className="public-section public-about">
        <div>
          <p className="public-eyebrow">
            ABOUT NIGFILM
          </p>

          <h2>
            Built for digital movie distribution and streaming.
          </h2>
        </div>

        <div>
          <p>
            NIGFILM aims to provide an easy-to-use platform where viewers can discover available content and watch it through the access options provided by the service.
          </p>

          <p>
            NIGFILM respects copyright and intellectual property. Content should only be published or distributed where the appropriate rights, licences, permissions, or authorizations exist.
          </p>
        </div>
      </section>

      <section className="public-section public-rights-preview">
        <p className="public-eyebrow">
          COPYRIGHT & RIGHTS
        </p>

        <h2>
          We take copyright and intellectual property seriously.
        </h2>

        <p>
          If you are a copyright owner or an authorized representative and believe content on NIGFILM infringes your rights, you may submit a copyright complaint or takedown request for review.
        </p>

        <div className="public-hero-actions">
          <button
            type="button"
            className="public-primary-button"
            onClick={() => setPage("complaint")}
          >
            Copyright Complaint
          </button>

          <button
            type="button"
            className="public-secondary-button"
            onClick={() => setPage("takedown")}
          >
            Request Takedown
          </button>
        </div>
      </section>
    </main>
  );
}

function LegalLayout({
  title,
  subtitle,
  children,
  setPage,
}) {
  return (
    <main className="public-main legal-main">
      <button
        type="button"
        className="legal-back-button"
        onClick={() => setPage("landing")}
      >
        ← Back to NIGFILM
      </button>

      <article className="legal-card">
        <p className="public-eyebrow">
          NIGFILM LEGAL
        </p>

        <h1>{title}</h1>

        <p className="legal-subtitle">
          {subtitle}
        </p>

        <div className="legal-content">
          {children}
        </div>

        <p className="legal-updated">
          Last updated: August 2026
        </p>
      </article>
    </main>
  );
}

function TermsPage({ setPage }) {
  return (
    <LegalLayout
      title={LEGAL_PAGES.terms.title}
      subtitle={LEGAL_PAGES.terms.subtitle}
      setPage={setPage}
    >
      <h2>1. Acceptance of Terms</h2>

      <p>
        By using NIGFILM, you agree to follow these Terms of Service and other policies that apply to the platform.
      </p>

      <h2>2. User Accounts</h2>

      <p>
        Users are responsible for protecting their account credentials and for using their accounts appropriately.
      </p>

      <h2>3. Movie Access</h2>

      <p>
        Access to a movie may depend on a purchase, subscription, promotional access, rewarded access, or another access method offered by NIGFILM.
      </p>

      <h2>4. Payments</h2>

      <p>
        Payments may be processed by third-party payment providers. Users should review transaction details before completing a payment.
      </p>

      <h2>5. Prohibited Use</h2>

      <p>
        NIGFILM must not be used for unauthorized redistribution, unlawful copying, abusive scraping, account abuse, security attacks, or any activity that violates applicable law or the rights of others.
      </p>

      <h2>6. Availability</h2>

      <p>
        Content or features may change, be suspended, or become unavailable for licensing, technical, operational, or legal reasons.
      </p>

      <h2>7. Intellectual Property</h2>

      <p>
        NIGFILM branding, software, interface, and other platform materials are protected by applicable intellectual-property rights. Rights in movies and third-party content remain with their respective rights holders.
      </p>

      <h2>8. Account Action</h2>

      <p>
        NIGFILM may restrict or suspend an account where abuse, fraud, a security risk, or a violation of these Terms is identified.
      </p>

      <h2>9. Changes</h2>

      <p>
        These Terms may be updated as the service, applicable laws, or business operations change.
      </p>
    </LegalLayout>
  );
}

function CopyrightPage({ setPage }) {
  return (
    <LegalLayout
      title={LEGAL_PAGES.copyright.title}
      subtitle={LEGAL_PAGES.copyright.subtitle}
      setPage={setPage}
    >
      <p>
        NIGFILM respects copyright and other intellectual-property rights.
      </p>

      <h2>Content on NIGFILM</h2>

      <p>
        Content should only be created, published, streamed, or distributed where the appropriate rights, licence, permission, authorization, or other lawful basis exists.
      </p>

      <h2>Unauthorized Content</h2>

      <p>
        NIGFILM does not intend to host or continue distributing content that is determined to infringe copyright.
      </p>

      <h2>Rights Holder Complaints</h2>

      <p>
        A copyright owner or authorized representative may submit a complaint if they believe content on the platform infringes their rights.
      </p>

      <h2>Investigation</h2>

      <p>
        NIGFILM may review a complaint, request additional evidence, restrict access, or remove content where the information available supports such action.
      </p>

      <button
        type="button"
        className="public-primary-button"
        onClick={() => setPage("complaint")}
      >
        Submit Copyright Complaint
      </button>
    </LegalLayout>
  );
}

function RightsPage({ setPage }) {
  return (
    <LegalLayout
      title={LEGAL_PAGES.rights.title}
      subtitle={LEGAL_PAGES.rights.subtitle}
      setPage={setPage}
    >
      <p>
        NIGFILM is a digital distribution and streaming platform.
      </p>

      <p>
        NIGFILM does not claim ownership of every film, artwork, studio trademark, or other third-party intellectual property appearing on the platform unless NIGFILM actually owns those rights.
      </p>

      <h2>Distribution Authorization</h2>

      <p>
        Where third-party movies appear on NIGFILM, their use should be based on applicable distribution rights, licences, permissions, agreements, or authorizations obtained from the appropriate rights holders.
      </p>

      <h2>Ownership</h2>

      <p>
        Original copyright and ownership of a film or related materials may remain with the producer, studio, distributor, or other applicable rights holder.
      </p>

      <h2>Disputes</h2>

      <p>
        If a rights holder believes a rights or authorization statement is inaccurate, they may submit a copyright complaint for review.
      </p>
    </LegalLayout>
  );
}

function ComplaintPage({ setPage }) {
  return (
    <LegalLayout
      title={LEGAL_PAGES.complaint.title}
      subtitle={LEGAL_PAGES.complaint.subtitle}
      setPage={setPage}
    >
      <p>
        If you are a copyright owner or authorized representative, you may ask NIGFILM to review content that you believe infringes your rights.
      </p>

      <h2>Information Required</h2>

      <p>
        A complaint should include the complainant’s name, contact information, identification of the content in question, a description of the rights claimed, and evidence or authorization information that can help verify the complaint.
      </p>

      <h2>Good-Faith Declaration</h2>

      <p>
        The complainant should confirm that the information provided is accurate to the best of their knowledge and that they are authorized to submit the complaint.
      </p>

      <h2>Review Process</h2>

      <p>
        After receiving a complaint, NIGFILM may review the information, request additional evidence, contact relevant parties, restrict access to content, or remove it where the circumstances support such action.
      </p>

      <button
        type="button"
        className="public-primary-button"
        onClick={() => setPage("takedown")}
      >
        Continue to Takedown Request
      </button>
    </LegalLayout>
  );
}

function TakedownPage({ setPage }) {
  return (
    <LegalLayout
      title={LEGAL_PAGES.takedown.title}
      subtitle={LEGAL_PAGES.takedown.subtitle}
      setPage={setPage}
    >
      <p>
        This page is intended for copyright owners or authorized representatives who want to request review or removal of content.
      </p>

      <div className="takedown-notice">
        <strong>
          Takedown submission system
        </strong>

        <p>
          NIGFILM is preparing a dedicated takedown submission form. Until a secure backend submission process is available, do not send sensitive documents through an unverified form.
        </p>
      </div>

      <h2>Prepare the following information</h2>

      <p>
        Prepare identification of the content, information showing ownership or authority, contact details, the reason for the request, and relevant evidence for review.
      </p>

      <h2>What NIGFILM may do</h2>

      <p>
        After receiving a valid request, NIGFILM may review the content, temporarily restrict access, request additional information, or remove the content where appropriate.
      </p>

      <button
        type="button"
        className="public-secondary-button"
        onClick={() => setPage("copyright")}
      >
        Read Copyright Policy
      </button>
    </LegalLayout>
  );
}

export default function PublicPages({
  page = "landing",
  setPage,
  onLogin,
  onRegister,
}) {
  let content = null;

  if (page === "terms") {
    content = <TermsPage setPage={setPage} />;
  } else if (page === "copyright") {
    content = <CopyrightPage setPage={setPage} />;
  } else if (page === "rights") {
    content = <RightsPage setPage={setPage} />;
  } else if (page === "complaint") {
    content = <ComplaintPage setPage={setPage} />;
  } else if (page === "takedown") {
    content = <TakedownPage setPage={setPage} />;
  } else {
    content = (
      <LandingPage
        setPage={setPage}
        onLogin={onLogin}
        onRegister={onRegister}
      />
    );
  }

  return (
    <div className="public-site">
      <PublicHeader
        page={page}
        setPage={setPage}
        onLogin={onLogin}
        onRegister={onRegister}
      />

      {content}

      <PublicFooter setPage={setPage} />
    </div>
  );
}