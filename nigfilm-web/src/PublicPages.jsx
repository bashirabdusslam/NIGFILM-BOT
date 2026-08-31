

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
  privacy: {
    title: "Privacy Policy",
    subtitle: "How NIGFILM handles information and privacy",
  },
  about: {
    title: "About NIGFILM",
    subtitle: "Learn more about the NIGFILM platform",
  },
  contact: {
    title: "Contact Us",
    subtitle: "Support, business and rights enquiries",
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
          type="button" className="public-login-link" onClick={onLogin}
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
      <div className="public-footer-inner">
        <div className="public-footer-brand">
          <strong>
            NIG<span>FILM</span>
          </strong>

          <p>
            Movies at your fingertips. NIGFILM provides a simple digital
            platform for discovering and watching entertainment content.
          </p>
        </div>

        <div className="public-footer-links">
          <button type="button" onClick={() => setPage("about")}>
            About Us
          </button>

          <button type="button" onClick={() => setPage("contact")}>
            Contact Us
          </button>

          <button type="button" onClick={() => setPage("privacy")}>
            Privacy Policy
          </button>

          <button type="button" onClick={() => setPage("terms")}>
            Terms of Service
          </button>

          <button type="button" onClick={() => setPage("copyright")}>
            Copyright Policy
          </button>

          <button type="button" onClick={() => setPage("rights")}>
            Rights & Ownership
          </button>

          <button type="button" onClick={() => setPage("complaint")}>
            Copyright Complaint
          </button>

          <button type="button" onClick={() => setPage("takedown")}>
            Request Takedown
          </button>
        </div>

        <p className="public-footer-copy">
          © {new Date().getFullYear()} NIGFILM. All rights reserved.
        </p>
      </div>
    </footer>
  );
}

function LandingPage({
  setPage,
  onLogin,
  onRegister,
  films = [],
  filmsLoading = false,
  apiUrl = "",
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
          <article className="public-feature-card">
            <span className="public-feature-icon">
              🎬
            </span>

            <h3>Browse Movies</h3>

            <p>
              Browse movies by category, studio, or title.
            </p>
          </article>

          <article className="public-feature-card">
            <span className="public-feature-icon">
              ▶
            </span>

            <h3>Stream Online</h3>

            <p>
              Stream content you have access to directly on NIGFILM.
            </p>
          </article>

          <article className="public-feature-card">
            <span className="public-feature-icon">
              🏢
            </span>

            <h3>Studios</h3>

            <p>
              Discover movies by studio or the company associated with the content.
            </p>
          </article>

          <article className="public-feature-card">
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
            <section className="public-section public-movies-section">
        <div className="public-section-heading">
          <p>NOW ON NIGFILM</p>

          <h2>Discover movies on NIGFILM</h2>

          <span>
            Explore some of the movies currently available on our platform.
          </span>
        </div>

        {filmsLoading ? (
          <div className="public-movies-loading">
            Loading movies...
          </div>
        ) : films.length > 0 ? (
          <div className="public-movie-grid">
            {films.slice(0, 8).map((film) => (
              <article
                className="public-movie-card"
                key={film.id}
              >
               <div className="public-movie-poster">
                  {film.posterUrl ? (
                    <img
                      src={
                        film.posterUrl?.startsWith("http")
                          ? film.posterUrl
                          : `${apiUrl}${film.posterUrl}`
                      }
                      alt={`${film.title || "Movie"} poster`}
                      loading="lazy"
                    />
                  ) : (
                    <div className="public-movie-placeholder">
                      🎬
                    </div>
                  )}
                </div>

                <div className="public-movie-info">
                  <h3>{film.title || "NIGFILM Movie"}</h3>

                  <p>
                    {film.studio?.name ||
                      film.category ||
                      "Available on NIGFILM"}
                  </p>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="public-movies-loading">
            Movies will appear here as they become available.
          </div>
        )}

        <div className="public-movies-action">
          <button
            type="button"
            className="public-primary-button"
            onClick={onRegister}
          >
            Create Account to Explore
          </button>
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


function AboutPage({ setPage }) {
  return (
    <LegalLayout
      title={LEGAL_PAGES.about.title}
      subtitle={LEGAL_PAGES.about.subtitle}
      setPage={setPage}
    >
      <p>
        NIGFILM is a digital entertainment platform created to make
        discovering and watching movies simple and convenient.
      </p>

      <p>
        Our platform brings together entertainment content including Hausa
        movies, Hausa-dubbed movies, series, trailers, and other available
        movie content.
      </p>

      <h2>What We Offer</h2>
      <p>
        Users can browse movies by category, discover new releases, search for
        available titles, continue watching content, and access movies
        available through their accounts.
      </p>

      <h2>Our Goal</h2>
      <p>
        Our goal is to build an easy-to-use entertainment platform with a
        strong focus on Hausa-speaking audiences while remaining accessible to
        a wider audience.
      </p>

      <h2>Content & Rights</h2>
      <p>
        NIGFILM aims to make available content that it is authorized to
        distribute or otherwise permitted to provide through the platform.
        Rights holders may contact us regarding content available on NIGFILM.
      </p>

      <h2>Customer Support</h2>
      <p>
        Users can contact NIGFILM for account, payment, movie access,
        technical, privacy, or general support.
      </p>

      <div className="takedown-notice">
        <strong>Email:</strong>{" "}
        <a href="mailto:bashirabdusslam34@gmail.com">
          bashirabdusslam34@gmail.com
        </a>
      </div>

      <h2>Business & Content Enquiries</h2>
      <p>
        Studios, content owners, authorized representatives, and business
        partners may contact NIGFILM regarding licensing, distribution,
        partnerships, or content available on the platform.
      </p>

      <button
        type="button"
        className="public-secondary-button"
        onClick={() => setPage("contact")}
      >
        Contact NIGFILM
      </button>
    </LegalLayout>
  );
}

function ContactPage({ setPage }) {
  return (
    <LegalLayout
      title={LEGAL_PAGES.contact.title}
      subtitle={LEGAL_PAGES.contact.subtitle}
      setPage={setPage}
    >
      <p>
        We're here to help. Contact NIGFILM if you need assistance with your
        account, movie access, payments, subscriptions, or other services
        available on the platform.
      </p>

      <div className="takedown-notice">
        <strong>Customer Support</strong>
        <p>For general questions and customer support:</p>
        <p>
          <strong>Email:</strong>{" "}
          <a href="mailto:bashirabdusslam34@gmail.com">
            bashirabdusslam34@gmail.com
          </a>
        </p>
      </div>

      <h2>Payment & Account Support</h2>
      <p>
        If you experience an issue with your account, payment, subscription, or
        access to purchased content, contact our support email and provide
        enough information for us to investigate the issue.
      </p>

      <h2>Business & Content Enquiries</h2>
      <p>
        Studios, content owners, authorized representatives, and business
        partners may contact NIGFILM regarding licensing, distribution,
        partnerships, or content available on the platform.
      </p>

      <h2>Copyright & Rights Enquiries</h2>
      <p>
        Rights holders or their authorized representatives may contact us if
        they have questions or concerns regarding content available through
        NIGFILM.
      </p>

      <p>
        Please identify the relevant content and provide sufficient information
        to allow us to review the request.
      </p>

      <h2>Response Time</h2>
      <p>
        We aim to review legitimate support and business enquiries as soon as
        reasonably possible.
      </p>

      <button
        type="button"
        className="public-secondary-button"
        onClick={() => setPage("privacy")}
      >
        Read Privacy Policy
      </button>
    </LegalLayout>
  );
}

function PrivacyPage({ setPage }) {
  return (
    <LegalLayout
      title={LEGAL_PAGES.privacy.title}
      subtitle={LEGAL_PAGES.privacy.subtitle}
      setPage={setPage}
    >
      <p>
        NIGFILM respects your privacy. This Privacy Policy explains how
        information may be collected, used, stored, and protected when you use
        the NIGFILM website or mobile application.
      </p>

      <h2>1. Information We Collect</h2>
      <p>
        When you create or use a NIGFILM account, we may collect information
        such as your name, phone number, account preferences, language
        preference, and account activity.
      </p>
      <p>
        We may also process information relating to movie purchases,
        subscriptions, viewing access, watch progress, advertising unlocks, and
        transaction references required to operate the service.
      </p>

      <h2>2. Account Security</h2>
      <p>
        Passwords are not intended to be stored in plain text. Authentication
        and session information may be used to keep users signed in and protect
        accounts from unauthorized access.
      </p>

      <h2>3. Payments</h2>
      <p>
        NIGFILM may use third-party payment providers to process purchases and
        subscriptions. Payment providers may collect information required to
        complete a transaction according to their own privacy policies.
      </p>
      <p>
        NIGFILM does not require users to provide card information directly to
        NIGFILM where payment details are handled by the payment provider.
      </p>

      <h2>4. Movie Activity</h2>
      <p>
        We may store information about purchased movies, subscription status,
        viewing progress, and access permissions so that features such as My
        Movies, Continue Watching, Premium access, and movie unlocks can
        function correctly.
      </p>

      <h2>5. Advertising</h2>
      <p>
        NIGFILM may display advertising or offer advertising as one method of
        gaining access to selected content. Advertising providers may process
        device, advertising, usage, or diagnostic information according to
        their own policies.
      </p>

      <h2>6. Device and Technical Information</h2>
      <p>
        The application or services used by NIGFILM may automatically process
        limited technical information, such as browser or device information,
        IP address, app diagnostics, and usage information where required for
        security, performance, analytics, or advertising.
      </p>

      <h2>7. How We Use Information</h2>
      <p>
        Information may be used to provide and maintain the NIGFILM service,
        authenticate users, process access to movies, manage subscriptions and
        purchases, improve performance, prevent abuse, provide customer
        support, and comply with legal obligations.
      </p>

      <h2>8. Third-Party Services</h2>
      <p>
        NIGFILM may use third-party services for hosting, video streaming,
        payments, advertising, analytics, and other infrastructure necessary to
        operate the platform.
      </p>
      <p>
        These providers may process information according to their own privacy
        policies.
      </p>

      <h2>9. Data Retention</h2>
      <p>
        We retain information only for as long as reasonably necessary to
        provide the service, maintain transaction records, protect users,
        resolve disputes, and comply with applicable legal requirements.
      </p>

      <h2>10. Children's Privacy</h2>
      <p>
        NIGFILM is not intended to knowingly collect personal information from
        children where parental consent or another lawful basis is required.
        Age suitability may also depend on the rating and nature of individual
        movies available on the platform.
      </p>

      <h2>11. Your Choices</h2>
      <p>
        Users may contact NIGFILM regarding questions about their account,
        personal information, or privacy practices.
      </p>

      <h2>12. Changes to This Policy</h2>
      <p>
        We may update this Privacy Policy when our services, legal
        requirements, or privacy practices change. Updates will be published on
        this page.
      </p>

      <h2>13. Contact Us</h2>
      <p>
        For privacy questions or support, contact NIGFILM at{" "}
        <a href="mailto:bashirabdusslam34@gmail.com">
          bashirabdusslam34@gmail.com
        </a>.
      </p>
    </LegalLayout>
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
  films = [],
  filmsLoading = false,
  apiUrl = "",
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
  } else if (page === "privacy") {
    content = <PrivacyPage setPage={setPage} />;
  } else if (page === "about") {
    content = <AboutPage setPage={setPage} />;
  } else if (page === "contact") {
    content = <ContactPage setPage={setPage} />;
  } else {
    content = (
      <LandingPage
  setPage={setPage}
  onLogin={onLogin}
  onRegister={onRegister}
  films={films}
  filmsLoading={filmsLoading}
  apiUrl={apiUrl}
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