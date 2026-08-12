import { useEffect, useMemo, useState } from "react";
import "./App.css";

// =====================================================
// CONFIG
// =====================================================

const API_URL =
  import.meta.env.VITE_API_URL ||
  "http://localhost:3000";

const BUNNY_LIBRARY_ID =
  import.meta.env.VITE_BUNNY_LIBRARY_ID ||
  "726332";

// =====================================================
// APP
// =====================================================

function App() {
  // ===================================================
  // AUTH
  // ===================================================

  const [user, setUser] = useState(() => {
    try {
      const saved =
        localStorage.getItem("nigfilm_user");

      return saved
        ? JSON.parse(saved)
        : null;
    } catch {
      return null;
    }
  });

  const [authMode, setAuthMode] =
    useState("login");

  const [fullName, setFullName] =
    useState("");

  const [phone, setPhone] =
    useState("");

  const [password, setPassword] =
    useState("");

  const [authLoading, setAuthLoading] =
    useState(false);

  const [authError, setAuthError] =
    useState("");

  // ===================================================
  // PAGE
  // ===================================================

  const [page, setPage] =
    useState("home");

  const [selectedFilm, setSelectedFilm] =
    useState(null);

  // ===================================================
  // FILMS
  // ===================================================

  const [films, setFilms] =
    useState([]);

  const [filmsLoading, setFilmsLoading] =
    useState(false);

  const [filmsError, setFilmsError] =
    useState("");

  const [search, setSearch] =
    useState("");

  const [
    activeCategory,
    setActiveCategory,
  ] = useState("All");

  // ===================================================
  // MY MOVIES
  // ===================================================

  const [myMovies, setMyMovies] =
    useState([]);

  const [
    myMoviesLoading,
    setMyMoviesLoading,
  ] = useState(false);

  const [
    myMoviesError,
    setMyMoviesError,
  ] = useState("");

  // ===================================================
  // PAYMENT
  // ===================================================

  const [
    paymentLoading,
    setPaymentLoading,
  ] = useState(false);

  const [
    paymentError,
    setPaymentError,
  ] = useState("");

  // ===================================================
  // VIDEO
  // ===================================================

  const [videoError, setVideoError] =
    useState("");

  // ===================================================
  // INITIAL LOAD
  // ===================================================

  useEffect(() => {
    loadFilms();
  }, []);

  useEffect(() => {
    if (user?.id) {
      loadMyMovies(false);
    }
  }, [user?.id]);

  // ===================================================
  // FILM NORMALIZER
  // ===================================================

  function normalizeFilm(rawFilm) {
    if (!rawFilm) {
      return null;
    }

    const film =
      rawFilm.film ||
      rawFilm;

    return {
      ...film,

      id: Number(film.id),

      price: Number(
        film.price || 0
      ),

      posterUrl:
        film.posterUrl ||
        `/api/films/${film.id}/poster`,
    };
  }

  // ===================================================
  // POSTER
  // ===================================================

  function posterSrc(film) {
    if (!film) {
      return "";
    }

    const url =
      film.posterUrl ||
      `/api/films/${film.id}/poster`;

    if (
      String(url).startsWith("http")
    ) {
      return url;
    }

    return `${API_URL}${url}`;
  }

  // ===================================================
  // PURCHASE HELPERS
  // ===================================================

  function isPurchased(filmId) {
    return myMovies.some((item) => {
      const movie =
        normalizeFilm(item);

      return (
        Number(movie?.id) ===
        Number(filmId)
      );
    });
  }

  function findPurchasedMovie(filmId) {
    const found =
      myMovies.find((item) => {
        const movie =
          normalizeFilm(item);

        return (
          Number(movie?.id) ===
          Number(filmId)
        );
      });

    return normalizeFilm(found);
  }

  // ===================================================
  // BUNNY PLAYER URL
  // ===================================================

  function bunnyPlayerUrl(film) {
    if (!film) {
      return "";
    }

    if (film.playerUrl) {
      return film.playerUrl;
    }

    if (film.webVideoUrl) {
      return film.webVideoUrl;
    }

    if (film.bunnyVideoId) {
      return (
        `https://player.mediadelivery.net/embed/` +
        `${BUNNY_LIBRARY_ID}/` +
        `${film.bunnyVideoId}`
      );
    }

    return "";
  }

  // ===================================================
  // NAVIGATION
  // ===================================================

  function goHome() {
    setPage("home");

    setSelectedFilm(null);

    setVideoError("");

    setPaymentError("");

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  function goSearch() {
    setPage("home");

    setSelectedFilm(null);

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });

    setTimeout(() => {
      document
        .querySelector(
          ".search-box input"
        )
        ?.focus();
    }, 300);
  }

  function openFilm(film) {
    const movie =
      normalizeFilm(film);

    setSelectedFilm(movie);

    setPage("details");

    setPaymentError("");

    setVideoError("");

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  function openProfile() {
    setPage("profile");

    setSelectedFilm(null);

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  // ===================================================
  // LOAD FILMS
  // ===================================================

  async function loadFilms() {
    try {
      setFilmsLoading(true);

      setFilmsError("");

      const response =
        await fetch(
          `${API_URL}/api/films`
        );

      const data =
        await readJson(response);

      if (!response.ok) {
        throw new Error(
          data?.message ||
          "An kasa ɗauko fina-finai."
        );
      }

      const result =
        Array.isArray(data?.films)
          ? data.films
              .map(normalizeFilm)
              .filter(Boolean)
          : [];

      setFilms(result);
    } catch (error) {
      console.error(
        "LOAD FILMS ERROR:",
        error
      );

      setFilmsError(
        error.message ||
        "An samu matsala wajen ɗauko fina-finai."
      );
    } finally {
      setFilmsLoading(false);
    }
  }

  // ===================================================
  // REGISTER
  // ===================================================

  async function handleRegister(event) {
    event.preventDefault();

    try {
      setAuthLoading(true);

      setAuthError("");

      const response =
        await fetch(
          `${API_URL}/api/auth/register`,
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify({
              fullName:
                fullName.trim(),

              phone:
                phone.trim(),

              password,
            }),
          }
        );

      const data =
        await readJson(response);

      if (!response.ok) {
        throw new Error(
          data?.message ||
          "Register bai yi nasara ba."
        );
      }

      if (!data?.user?.id) {
        throw new Error(
          "Backend bai dawo da user ID ba."
        );
      }

      localStorage.setItem(
        "nigfilm_user",
        JSON.stringify(data.user)
      );

      setUser(data.user);

      setPassword("");

      setPage("home");
    } catch (error) {
      console.error(
        "REGISTER ERROR:",
        error
      );

      setAuthError(
        error.message ||
        "Register bai yi nasara ba."
      );
    } finally {
      setAuthLoading(false);
    }
  }

  // ===================================================
  // LOGIN
  // ===================================================

  async function handleLogin(event) {
    event.preventDefault();

    try {
      setAuthLoading(true);

      setAuthError("");

      const response =
        await fetch(
          `${API_URL}/api/auth/login`,
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify({
              phone:
                phone.trim(),

              password,
            }),
          }
        );

      const data =
        await readJson(response);

      if (!response.ok) {
        throw new Error(
          data?.message ||
          "Login bai yi nasara ba."
        );
      }

      if (!data?.user?.id) {
        throw new Error(
          "Backend bai dawo da user ID ba."
        );
      }

      localStorage.setItem(
        "nigfilm_user",
        JSON.stringify(data.user)
      );

      setUser(data.user);

      setPassword("");

      setPage("home");
    } catch (error) {
      console.error(
        "LOGIN ERROR:",
        error
      );

      setAuthError(
        error.message ||
        "Login bai yi nasara ba."
      );
    } finally {
      setAuthLoading(false);
    }
  }

  // ===================================================
  // LOGOUT
  // ===================================================

  function logout() {
    localStorage.removeItem(
      "nigfilm_user"
    );

    setUser(null);

    setMyMovies([]);

    setSelectedFilm(null);

    setFullName("");

    setPhone("");

    setPassword("");

    setAuthMode("login");

    setPage("home");
  }

  // ===================================================
  // LOAD MY MOVIES
  // ===================================================

  async function loadMyMovies(
    changePage = true
  ) {
    if (!user?.id) {
      return;
    }

    if (changePage) {
      setPage("myMovies");

      setSelectedFilm(null);

      window.scrollTo({
        top: 0,
        behavior: "smooth",
      });
    }

    try {
      setMyMoviesLoading(true);

      setMyMoviesError("");

      const response =
        await fetch(
          `${API_URL}/api/web/my-movies?webUserId=${user.id}`
        );

      const data =
        await readJson(response);

      if (!response.ok) {
        throw new Error(
          data?.message ||
          "An kasa ɗauko My Movies."
        );
      }

      const rawMovies =
        data?.movies ||
        data?.films ||
        data?.purchases ||
        [];

      const movies =
        Array.isArray(rawMovies)
          ? rawMovies
              .map(normalizeFilm)
              .filter(Boolean)
          : [];

      setMyMovies(movies);
    } catch (error) {
      console.error(
        "MY MOVIES ERROR:",
        error
      );

      setMyMoviesError(
        error.message ||
        "An samu matsala wajen ɗauko fina-finan da ka saya."
      );
    } finally {
      setMyMoviesLoading(false);
    }
  }

  // ===================================================
  // BUY MOVIE
  // ===================================================

  async function buyMovie(film) {
    if (!user?.id) {
      return;
    }

    if (isPurchased(film.id)) {
      const purchasedFilm =
        findPurchasedMovie(
          film.id
        ) || film;

      openFilm(
        purchasedFilm
      );

      return;
    }

    try {
      setPaymentLoading(true);

      setPaymentError("");

      const response =
        await fetch(
          `${API_URL}/api/web/payments/initialize`,
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify({
              webUserId:
                user.id,

              filmId:
                film.id,
            }),
          }
        );

      const data =
        await readJson(response);

      if (!response.ok) {
        throw new Error(
          data?.message ||
          "An kasa fara payment."
        );
      }

      if (!data.authorizationUrl) {
        throw new Error(
          "Paystack payment URL bai samu ba."
        );
      }

      window.location.href =
        data.authorizationUrl;
    } catch (error) {
      console.error(
        "PAYMENT ERROR:",
        error
      );

      setPaymentError(
        error.message ||
        "An samu matsala wajen buɗe Paystack."
      );
    } finally {
      setPaymentLoading(false);
    }
  }

  // ===================================================
  // DIRECT MOVIE DOWNLOAD
  // ===================================================

  function downloadMovie(film) {
    if (!user?.id) {
      return;
    }

    if (!isPurchased(film.id)) {
      setVideoError(
        "Sai ka sayi film kafin download."
      );

      return;
    }

    setVideoError("");

    /*
      Backend ɗinmu zai:
      1. Duba WebPurchase.
      2. Samo Bunny video.
      3. Stream file.
      4. Sa Content-Disposition: attachment.

      Saboda haka browser zai fara download
      ba tare da zuwa Bunny page ba.
    */

    const downloadUrl =
      `${API_URL}/api/web/movies/` +
      `${film.id}/download` +
      `?webUserId=${user.id}`;

    const anchor =
      document.createElement("a");

    anchor.href =
      downloadUrl;

    anchor.download =
      `${film.title || "NIGFILM"}.mp4`;

    anchor.style.display =
      "none";

    document.body.appendChild(
      anchor
    );

    anchor.click();

    anchor.remove();
  }

  // ===================================================
  // FILTER FILMS
  // ===================================================

  const filteredFilms =
    useMemo(() => {
      const query =
        search
          .trim()
          .toLowerCase();

      return films.filter(
        (film) => {
          const title =
            String(
              film.title || ""
            ).toLowerCase();

          const description =
            String(
              film.description ||
              ""
            ).toLowerCase();

          const category =
            String(
              film.category || ""
            )
              .trim()
              .toLowerCase();

          const matchesSearch =
            !query ||
            title.includes(query) ||
            description.includes(
              query
            ) ||
            category.includes(query);

          let matchesCategory =
            true;

          if (
            activeCategory ===
            "Hausa"
          ) {
            matchesCategory =
              category.includes(
                "hausa"
              );
          }

          if (
            activeCategory ===
            "India Fassara"
          ) {
            matchesCategory =
              category.includes(
                "india"
              ) ||
              category.includes(
                "indian"
              );
          }

          if (
            activeCategory ===
            "American"
          ) {
            matchesCategory =
              category.includes(
                "american"
              ) ||
              category.includes(
                "america"
              );
          }

          if (
            activeCategory ===
            "Series"
          ) {
            matchesCategory =
              category.includes(
                "series"
              );
          }

          return (
            matchesSearch &&
            matchesCategory
          );
        }
      );
    }, [
      films,
      search,
      activeCategory,
    ]);

  // ===================================================
  // AUTH PAGE
  // ===================================================

  if (!user) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <div className="auth-logo">
            NIG<span>FILM</span>
          </div>

          <p className="auth-subtitle">
            Fina-finai a hannunka.
          </p>

          <div className="auth-switch">
            <button
              type="button"
              className={
                authMode ===
                "register"
                  ? "active"
                  : ""
              }
              onClick={() => {
                setAuthMode(
                  "register"
                );

                setAuthError("");
              }}
            >
              Register
            </button>

            <button
              type="button"
              className={
                authMode ===
                "login"
                  ? "active"
                  : ""
              }
              onClick={() => {
                setAuthMode(
                  "login"
                );

                setAuthError("");
              }}
            >
              Login
            </button>
          </div>

          {authMode ===
          "register" ? (
            <form
              className="auth-form"
              onSubmit={
                handleRegister
              }
            >
              <h2>
                Create Account
              </h2>

              <p>
                Ƙirƙiri account
                domin siya da kallon
                fina-finai.
              </p>

              <label>
                Full Name

                <input
                  type="text"
                  value={fullName}
                  placeholder="Bashir Abdussalam"
                  onChange={(
                    event
                  ) =>
                    setFullName(
                      event.target
                        .value
                    )
                  }
                  required
                />
              </label>

              <label>
                Phone Number

                <input
                  type="tel"
                  value={phone}
                  placeholder="08012345678"
                  onChange={(
                    event
                  ) =>
                    setPhone(
                      event.target
                        .value
                    )
                  }
                  required
                />
              </label>

              <label>
                Password

                <input
                  type="password"
                  value={password}
                  placeholder="Aƙalla haruffa 6"
                  onChange={(
                    event
                  ) =>
                    setPassword(
                      event.target
                        .value
                    )
                  }
                  minLength={6}
                  required
                />
              </label>

              {authError && (
                <div className="auth-error">
                  {authError}
                </div>
              )}

              <button
                type="submit"
                className="auth-submit"
                disabled={
                  authLoading
                }
              >
                {authLoading
                  ? "Ana ƙirƙira..."
                  : "Create Account"}
              </button>

              <p className="auth-bottom-text">
                Kana da account?{" "}
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode(
                      "login"
                    );

                    setAuthError("");
                  }}
                >
                  Login
                </button>
              </p>
            </form>
          ) : (
            <form
              className="auth-form"
              onSubmit={
                handleLogin
              }
            >
              <h2>
                Welcome Back
              </h2>

              <p>
                Shiga NIGFILM
                account ɗinka.
              </p>

              <label>
                Phone Number

                <input
                  type="tel"
                  value={phone}
                  placeholder="08012345678"
                  onChange={(
                    event
                  ) =>
                    setPhone(
                      event.target
                        .value
                    )
                  }
                  required
                />
              </label>

              <label>
                Password

                <input
                  type="password"
                  value={password}
                  placeholder="Password"
                  onChange={(
                    event
                  ) =>
                    setPassword(
                      event.target
                        .value
                    )
                  }
                  required
                />
              </label>

              {authError && (
                <div className="auth-error">
                  {authError}
                </div>
              )}

              <button
                type="submit"
                className="auth-submit"
                disabled={
                  authLoading
                }
              >
                {authLoading
                  ? "Ana shiga..."
                  : "Login"}
              </button>

              <p className="auth-bottom-text">
                Ba ka da account?{" "}
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode(
                      "register"
                    );

                    setAuthError("");
                  }}
                >
                  Register
                </button>
              </p>
            </form>
          )}
        </div>
      </div>
    );
  }

  // ===================================================
  // COMMON HEADER
  // ===================================================

  const header = (
    <header className="header">
      <div>
        <p className="welcome">
          Welcome,{" "}
          {user.fullName}
        </p>

        <h1>
          NIG<span>FILM</span>
        </h1>
      </div>

      <button
        type="button"
        className="profile"
        title="Profile"
        onClick={
          openProfile
        }
      >
        👤
      </button>
    </header>
  );

  // ===================================================
  // DETAILS PAGE
  // ===================================================

  if (
    page === "details" &&
    selectedFilm
  ) {
    const purchased =
      isPurchased(
        selectedFilm.id
      );

    const purchasedFilm =
      findPurchasedMovie(
        selectedFilm.id
      );

    const movie =
      purchasedFilm ||
      selectedFilm;

    const playerUrl =
      purchased
        ? bunnyPlayerUrl(movie)
        : "";

    return (
      <div className="app movie-details-page">
        {header}

        <main className="movie-details">
          <button
            type="button"
            className="back-button"
            onClick={() => {
              if (purchased) {
                loadMyMovies();
              } else {
                goHome();
              }
            }}
          >
            ← Back
          </button>

          <div className="movie-details-card">
            <div className="details-poster-wrapper">
              <img
                src={
                  posterSrc(movie)
                }
                alt={
                  movie.title
                }
                className="details-poster"
              />

              <span className="details-price-badge">
                ₦
                {Number(
                  movie.price || 0
                ).toLocaleString()}
              </span>
            </div>

            <div className="details-content">
              <p className="small-title">
                {purchased
                  ? "MY MOVIE"
                  : "NIGFILM MOVIE"}
              </p>

              <h2>
                {movie.title}
              </h2>

              <div className="details-meta">
                <span>
                  🎬{" "}
                  {movie.category ||
                    "Movie"}
                </span>

                {purchased && (
                  <span>
                    ✅ Purchased
                  </span>
                )}

                <span>
                  ⭐ Premium
                </span>
              </div>

              <p className="details-description">
                {movie.description ||
                  "Babu cikakken bayanin wannan film tukuna."}
              </p>

              {/* =============================
                  BUNNY PLAYER
              ============================== */}

              {purchased &&
                playerUrl && (
                  <div className="bunny-player">
                    <iframe
                      src={
                        playerUrl
                      }
                      title={
                        movie.title
                      }
                      loading="lazy"
                      allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture"
                      allowFullScreen
                    />
                  </div>
                )}

              {purchased &&
                !playerUrl && (
                  <div className="movie-security-note">
                    ⏳ Video ɗin
                    wannan film bai
                    shirya a Bunny
                    Stream ba tukuna.
                  </div>
                )}

              {videoError && (
                <div className="auth-error">
                  {videoError}
                </div>
              )}

              {!purchased && (
                <div className="details-price">
                  <small>
                    Movie Price
                  </small>

                  <strong>
                    ₦
                    {Number(
                      movie.price || 0
                    ).toLocaleString()}
                  </strong>
                </div>
              )}

              {paymentError && (
                <div className="auth-error">
                  {paymentError}
                </div>
              )}

              <div className="details-actions">
                {!purchased ? (
                  <button
                    type="button"
                    className="buy-now-button"
                    disabled={
                      paymentLoading
                    }
                    onClick={() =>
                      buyMovie(movie)
                    }
                  >
                    {paymentLoading
                      ? "Ana buɗe Paystack..."
                      : "💳 Buy Now"}
                  </button>
                ) : (
                  <>
                    {playerUrl && (
                      <button
                        type="button"
                        className="buy-now-button"
                        onClick={() => {
                          document
                            .querySelector(
                              ".bunny-player"
                            )
                            ?.scrollIntoView({
                              behavior:
                                "smooth",
                              block:
                                "center",
                            });
                        }}
                      >
                        ▶ Watch Movie
                      </button>
                    )}

                    <button
                      type="button"
                      className="download-button"
                      onClick={() =>
                        downloadMovie(
                          movie
                        )
                      }
                    >
                      ⬇ Download
                    </button>
                  </>
                )}

                <button
                  type="button"
                  className="secondary-button"
                  onClick={() =>
                    loadMyMovies()
                  }
                >
                  🎬 My Movies
                </button>

                <button
                  type="button"
                  className="secondary-button"
                  onClick={
                    goHome
                  }
                >
                  🎞️ More Movies
                </button>
              </div>

              <div className="movie-security-note">
                {purchased
                  ? "🔒 Wannan film yana cikin My Movies ɗinka. Za ka iya kallonsa ko sauke shi."
                  : "🔒 Bayan Paystack ya tabbatar da payment, film zai shiga My Movies."}
              </div>
            </div>
          </div>
        </main>

        <BottomNav
          page={page}
          goHome={goHome}
          goSearch={goSearch}
          loadMyMovies={
            loadMyMovies
          }
          openProfile={
            openProfile
          }
        />
      </div>
    );
  }

  // ===================================================
  // MY MOVIES PAGE
  // ===================================================

  if (page === "myMovies") {
    return (
      <div className="app">
        {header}

        <section className="section movies-section">
          <div className="section-heading">
            <div>
              <p className="small-title">
                YOUR LIBRARY
              </p>

              <h2>
                My Movies
              </h2>
            </div>

            <span className="movie-count">
              {myMovies.length} Movies
            </span>
          </div>

          {myMoviesLoading && (
            <div className="status">
              <div className="loader" />

              <p>
                Ana ɗauko fina-finanka...
              </p>
            </div>
          )}

          {!myMoviesLoading &&
            myMoviesError && (
              <div className="status error">
                <p>
                  {myMoviesError}
                </p>

                <button
                  type="button"
                  onClick={() =>
                    loadMyMovies(
                      false
                    )
                  }
                >
                  Sake gwadawa
                </button>
              </div>
            )}

          {!myMoviesLoading &&
            !myMoviesError &&
            myMovies.length ===
              0 && (
              <div className="status">
                <p>
                  🎬 Ba ka sayi
                  film ba tukuna.
                </p>

                <button
                  type="button"
                  onClick={
                    goHome
                  }
                >
                  Browse Movies
                </button>
              </div>
            )}

          {!myMoviesLoading &&
            !myMoviesError &&
            myMovies.length >
              0 && (
              <MovieGrid
                films={
                  myMovies
                }
                posterSrc={
                  posterSrc
                }
                openFilm={
                  openFilm
                }
                purchased
              />
            )}
        </section>

        <BottomNav
          page={page}
          goHome={goHome}
          goSearch={goSearch}
          loadMyMovies={
            loadMyMovies
          }
          openProfile={
            openProfile
          }
        />
      </div>
    );
  }

  // ===================================================
  // PROFILE PAGE
  // ===================================================

  if (page === "profile") {
    return (
      <div className="app">
        {header}

        <main className="movie-details">
          <div className="movie-details-card">
            <div
              className="details-content"
              style={{
                gridColumn:
                  "1 / -1",
              }}
            >
              <p className="small-title">
                NIGFILM ACCOUNT
              </p>

              <h2>
                👤 Profile
              </h2>

              <div className="details-meta">
                <span>
                  👤{" "}
                  {user.fullName}
                </span>

                <span>
                  📱{" "}
                  {user.phone}
                </span>
              </div>

              <p className="details-description">
                Duk fina-finan da
                ka saya suna cikin
                My Movies ɗinka.
              </p>

              <div className="details-actions">
                <button
                  type="button"
                  className="buy-now-button"
                  onClick={() =>
                    loadMyMovies()
                  }
                >
                  🎬 My Movies
                </button>

                <button
                  type="button"
                  className="secondary-button"
                  onClick={
                    goHome
                  }
                >
                  🏠 Home
                </button>

                <button
                  type="button"
                  className="secondary-button"
                  onClick={
                    logout
                  }
                >
                  🚪 Logout
                </button>
              </div>
            </div>
          </div>
        </main>

        <BottomNav
          page={page}
          goHome={goHome}
          goSearch={goSearch}
          loadMyMovies={
            loadMyMovies
          }
          openProfile={
            openProfile
          }
        />
      </div>
    );
  }

  // ===================================================
  // HOME PAGE
  // ===================================================

  return (
    <div className="app">
      {header}

      <section className="search-section">
        <div className="search-box">
          <span>🔍</span>

          <input
            type="text"
            placeholder="Search movies..."
            value={search}
            onChange={(event) =>
              setSearch(
                event.target.value
              )
            }
          />
        </div>
      </section>

      <section className="hero-banner">
        <div className="hero-overlay">
          <span className="badge">
            NIGFILM
          </span>

          <h2>
            Watch the movies
            <br />
            you love.
          </h2>

          <p>
            Hausa • India Fassara •
            American • Series
          </p>

          <button
            type="button"
            onClick={() => {
              document
                .getElementById(
                  "movies"
                )
                ?.scrollIntoView({
                  behavior:
                    "smooth",
                });
            }}
          >
            🎬 Browse Movies
          </button>
        </div>
      </section>

      <section className="section">
        <div className="section-heading">
          <h2>
            Categories
          </h2>
        </div>

        <div className="categories">
          {[
            [
              "All",
              "🔥 All",
            ],

            [
              "Hausa",
              "🎬 Hausa",
            ],

            [
              "India Fassara",
              "🇮🇳 India Fassara",
            ],

            [
              "American",
              "🇺🇸 American",
            ],

            [
              "Series",
              "📺 Series",
            ],
          ].map(
            ([
              category,
              label,
            ]) => (
              <button
                key={
                  category
                }
                type="button"
                className={
                  activeCategory ===
                  category
                    ? "active"
                    : ""
                }
                onClick={() =>
                  setActiveCategory(
                    category
                  )
                }
              >
                {label}
              </button>
            )
          )}
        </div>
      </section>

      <section
        className="section movies-section"
        id="movies"
      >
        <div className="section-heading">
          <div>
            <p className="small-title">
              DISCOVER
            </p>

            <h2>
              {activeCategory ===
              "All"
                ? "Latest Movies"
                : activeCategory}
            </h2>
          </div>

          <span className="movie-count">
            {
              filteredFilms.length
            }{" "}
            Movies
          </span>
        </div>

        {filmsLoading && (
          <div className="status">
            <div className="loader" />

            <p>
              Ana ɗauko
              fina-finai...
            </p>
          </div>
        )}

        {!filmsLoading &&
          filmsError && (
            <div className="status error">
              <p>
                {filmsError}
              </p>

              <button
                type="button"
                onClick={
                  loadFilms
                }
              >
                Sake gwadawa
              </button>
            </div>
          )}

        {!filmsLoading &&
          !filmsError &&
          filteredFilms.length ===
            0 && (
            <div className="status">
              <p>
                🎬 Babu film
                a wannan category.
              </p>
            </div>
          )}

        {!filmsLoading &&
          !filmsError &&
          filteredFilms.length >
            0 && (
            <MovieGrid
              films={
                filteredFilms
              }
              posterSrc={
                posterSrc
              }
              openFilm={
                openFilm
              }
              purchased={false}
            />
          )}
      </section>

      <BottomNav
        page={page}
        goHome={goHome}
        goSearch={goSearch}
        loadMyMovies={
          loadMyMovies
        }
        openProfile={
          openProfile
        }
      />
    </div>
  );
}

// =====================================================
// MOVIE GRID
// =====================================================

function MovieGrid({
  films,
  posterSrc,
  openFilm,
  purchased,
}) {
  return (
    <div className="movie-grid">
      {films.map((rawFilm) => {
        const film =
          rawFilm?.film ||
          rawFilm;

        return (
          <article
            className="movie-card"
            key={film.id}
          >
            <div
              className="poster-container"
              role="button"
              tabIndex={0}
              onClick={() =>
                openFilm(film)
              }
              onKeyDown={(
                event
              ) => {
                if (
                  event.key ===
                    "Enter" ||
                  event.key ===
                    " "
                ) {
                  openFilm(
                    film
                  );
                }
              }}
            >
              <img
                src={
                  posterSrc(
                    film
                  )
                }
                alt={
                  film.title
                }
                className="poster"
                loading="lazy"
                onError={(event) => {
                  event.currentTarget.style.opacity =
                    "0.3";
                }}
              />

              {!purchased && (
                <span className="price">
                  ₦
                  {Number(
                    film.price ||
                      0
                  ).toLocaleString()}
                </span>
              )}

              <div className="play-button">
                ▶
              </div>
            </div>

            <div className="movie-info">
              <h3>
                {film.title}
              </h3>

              <p>
                {film.category ||
                  "Movie"}
              </p>

              <button
                type="button"
                onClick={() =>
                  openFilm(film)
                }
              >
                {purchased
                  ? "▶ Watch Movie"
                  : "View Movie"}
              </button>
            </div>
          </article>
        );
      })}
    </div>
  );
}

// =====================================================
// BOTTOM NAV
// =====================================================

function BottomNav({
  page,
  goHome,
  goSearch,
  loadMyMovies,
  openProfile,
}) {
  return (
    <>
      <div className="bottom-space" />

      <nav className="bottom-nav">
        <button
          type="button"
          className={
            page === "home"
              ? "active"
              : ""
          }
          onClick={
            goHome
          }
        >
          <span>🏠</span>
          Home
        </button>

        <button
          type="button"
          onClick={
            goSearch
          }
        >
          <span>🔍</span>
          Search
        </button>

        <button
          type="button"
          className={
            page ===
            "myMovies"
              ? "active"
              : ""
          }
          onClick={() =>
            loadMyMovies()
          }
        >
          <span>🎬</span>
          My Movies
        </button>

        <button
          type="button"
          className={
            page ===
            "profile"
              ? "active"
              : ""
          }
          onClick={
            openProfile
          }
        >
          <span>👤</span>
          Profile
        </button>
      </nav>
    </>
  );
}

// =====================================================
// SAFE JSON
// =====================================================

async function readJson(response) {
  const text =
    await response.text();

  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new Error(
      `Server ya dawo da response mara JSON (${response.status}).`
    );
  }
}

export default App;