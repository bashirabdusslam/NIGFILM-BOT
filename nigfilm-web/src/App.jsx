import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as tus from "tus-js-client";
import "./App.css";

// =====================================================
// CONFIG
// =====================================================

const API_URL =
  import.meta.env.VITE_API_URL ||
   "https://nigfilm-bot.onrender.com";

const BUNNY_LIBRARY_ID =
  import.meta.env.VITE_BUNNY_LIBRARY_ID ||
  "726332";

const TUTORIAL_VIDEO_URL =
  import.meta.env.VITE_TUTORIAL_VIDEO_URL ||
  "";

const REWARDED_AD_UNIT_PATH =
  import.meta.env.VITE_GOOGLE_REWARDED_AD_UNIT_PATH ||
  "";

function loadGooglePublisherTag() {
  return new Promise((resolve, reject) => {
    if (
      window.googletag?.apiReady &&
      window.googletag?.pubads
    ) {
      resolve(window.googletag);
      return;
    }

    window.googletag =
      window.googletag || {
        cmd: [],
      };

    const existingScript =
      document.getElementById(
        "nigfilm-google-publisher-tag"
      );

    const waitForApi = () => {
      window.googletag.cmd.push(() => {
        resolve(window.googletag);
      });
    };

    if (existingScript) {
      waitForApi();
      return;
    }

    const script =
      document.createElement("script");

    script.id =
      "nigfilm-google-publisher-tag";

    script.async = true;

    script.src =
      "https://securepubads.g.doubleclick.net/tag/js/gpt.js";

    script.onload = waitForApi;

    script.onerror = () => {
      reject(
        new Error(
          "An kasa loda Google Rewarded Ads."
        )
      );
    };

    document.head.appendChild(script);
  });
}

const UI_TEXT = {
  HAUSA: {
    search: "Nemo fina-finai...",
    categories: "Rukuni",
    discover: "GANO",
    latestMovies: "Sabbin Fina-finai",
    trailers: "Tallan Fina-finai",
    featured: "Zaɓaɓɓun Fina-finai",
    hausaMovies: "Fina-finan Hausa",
    indiaMovies: "India Fassara",
    americanMovies: "Fina-finan Amurka",
    series: "Series",
    browseMovies: "Duba Fina-finai",
    home: "Gida",
    searchNav: "Nema",
    myMovies: "Fina-finaina",
    profile: "Profile",
    welcome: "Barka",
    goodMorning: "Barka da Safiya",
    goodAfternoon: "Barka da Rana",
    goodEvening: "Barka da Dare",
    watchMovie: "Kalli Film",
    viewMovie: "Duba Film",
    buyNow: "Saya Yanzu",
    download: "Sauke",
    theme: "Theme",
    language: "Harshe",
    blackGold: "Black & Gold",
    whiteGold: "White & Gold",
    english: "English",
    hausa: "Hausa",
    accountSettings: "Saitunan Account",
    trailer: "Kalli Trailer",
    noTrailer: "Babu trailer a wannan film tukuna.",
    premiumCinema: "Fina-finai masu kyau a hannunka.",
  },
  ENGLISH: {
    search: "Search movies...",
    categories: "Categories",
    discover: "DISCOVER",
    latestMovies: "Latest Movies",
    trailers: "Movie Trailers",
    featured: "Featured Movies",
    hausaMovies: "Hausa Movies",
    indiaMovies: "India Dubbed",
    americanMovies: "American Movies",
    series: "Series",
    browseMovies: "Browse Movies",
    home: "Home",
    searchNav: "Search",
    myMovies: "My Movies",
    profile: "Profile",
    welcome: "Welcome",
    goodMorning: "Good Morning",
    goodAfternoon: "Good Afternoon",
    goodEvening: "Good Evening",
    watchMovie: "Watch Movie",
    viewMovie: "View Movie",
    buyNow: "Buy Now",
    download: "Download",
    theme: "Theme",
    language: "Language",
    blackGold: "Black & Gold",
    whiteGold: "White & Gold",
    english: "English",
    hausa: "Hausa",
    accountSettings: "Account Settings",
    trailer: "Watch Trailer",
    noTrailer: "No trailer is available for this movie yet.",
    premiumCinema: "Premium movies in your hands.",
  },
};

const FALLBACK_POSTER =
  "data:image/svg+xml;charset=UTF-8," +
  encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="600" height="900" viewBox="0 0 600 900">
      <defs>
        <linearGradient id="g" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stop-color="#17191f"/>
          <stop offset="1" stop-color="#07080b"/>
        </linearGradient>
      </defs>
      <rect width="600" height="900" fill="url(#g)"/>
      <circle cx="300" cy="390" r="85" fill="#d4af37" opacity="0.18"/>
      <polygon points="278,340 278,440 365,390" fill="#d4af37"/>
      <text x="300" y="560" text-anchor="middle" fill="#d4af37" font-family="Arial" font-size="38" font-weight="700">NIGFILM</text>
      <text x="300" y="610" text-anchor="middle" fill="#8b8e96" font-family="Arial" font-size="20">Movie Poster</text>
    </svg>
  `);

// =====================================================
// APP
// =====================================================

function App() {
  // ===================================================
  // SESSION TOKEN HELPER
  // ===================================================

  function getSessionToken() {
    return (
      localStorage.getItem(
        "nigfilm_session_token"
      ) || ""
    );
  }

  // ===================================================
  // AUTH
  // ===================================================

  const [user, setUser] = useState(() => {
    try {
      const saved =
        localStorage.getItem(
          "nigfilm_user"
        );

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
  // LANGUAGE + THEME
  // ===================================================

  const [language, setLanguage] = useState(() =>
    localStorage.getItem("nigfilm_language") || "HAUSA"
  );

  const [theme, setTheme] = useState(() =>
    localStorage.getItem("nigfilm_theme") || "BLACK_GOLD"
  );

  const t = (key) =>
    UI_TEXT[language]?.[key] ||
    UI_TEXT.ENGLISH[key] ||
    key;

  useEffect(() => {
    localStorage.setItem("nigfilm_language", language);
  }, [language]);

  useEffect(() => {
    localStorage.setItem("nigfilm_theme", theme);
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  function timeGreeting() {
    const hour = new Date().getHours();

    if (hour >= 5 && hour < 12) {
      return t("goodMorning");
    }

    if (hour >= 12 && hour < 17) {
      return t("goodAfternoon");
    }

    return t("goodEvening");
  }

  // ===================================================
  // PAGE
  // ===================================================

  const [page, setPage] =
    useState("home");

  const [
    selectedFilm,
    setSelectedFilm,
  ] = useState(null);

  const navigationReadyRef = useRef(false);

  function pageState(nextPage, film = null) {
    return {
      nigfilm: true,
      page: nextPage,
      filmId: film?.id ? Number(film.id) : null,
    };
  }

  function findFilmById(filmId) {
    const id = Number(filmId);
    if (!Number.isInteger(id)) return null;

    const purchased = myMovies.find((item) => {
      const movie = normalizeFilm(item);
      return Number(movie?.id) === id;
    });

    if (purchased) return normalizeFilm(purchased);

    return films.find((film) => Number(film?.id) === id) || null;
  }

  function applyHistoryState(state) {
    const nextPage = state?.page || "home";

    if (nextPage === "details") {
      const movie = findFilmById(state?.filmId);

      if (movie) {
        setSelectedFilm(movie);
        setPage("details");
      } else {
        setSelectedFilm(null);
        setPage("home");
      }
    } else {
      setSelectedFilm(null);
      setPage(nextPage);
    }

    setVideoError("");
    setPaymentError("");
    window.scrollTo({ top: 0, behavior: "auto" });
  }

  function navigateTo(nextPage, film = null, { replace = false } = {}) {
    const state = pageState(nextPage, film);

    if (replace) {
      window.history.replaceState(state, "", window.location.href);
    } else {
      window.history.pushState(state, "", window.location.href);
    }

    applyHistoryState(state);
  }

  // ===================================================
  // FILMS
  // ===================================================

  const [films, setFilms] =
    useState([]);

  const [
    filmsLoading,
    setFilmsLoading,
  ] = useState(false);

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
  // PREMIUM
  // ===================================================

  const [
    premiumStatus,
    setPremiumStatus,
  ] = useState(null);

  const [
    premiumLoading,
    setPremiumLoading,
  ] = useState(false);

  const [
    premiumError,
    setPremiumError,
  ] = useState("");

  const [
    premiumPlans,
    setPremiumPlans,
  ] = useState([]);

  const [
    premiumPlansLoading,
    setPremiumPlansLoading,
  ] = useState(false);

  const [
    premiumSubscribeLoading,
    setPremiumSubscribeLoading,
  ] = useState("");

  const [
    premiumSubscribeError,
    setPremiumSubscribeError,
  ] = useState("");

  const hasPremium =
    Boolean(premiumStatus?.premium);

  const [
    watchOptionsOpen,
    setWatchOptionsOpen,
  ] = useState(false);

  const [
    watchOptionsPosition,
    setWatchOptionsPosition,
  ] = useState({
    top: 120,
    left: 180,
  });

  const [
    tutorialOpen,
    setTutorialOpen,
  ] = useState(false);
// ===================================================
// WATCH ADS UNLOCK
// ===================================================

const [adUnlockStatus, setAdUnlockStatus] =
  useState(null);

const [adUnlockLoading, setAdUnlockLoading] =
  useState(false);

const [adWatchLoading, setAdWatchLoading] =
  useState(false);

const [adUnlockError, setAdUnlockError] =
  useState("");

const [adUnlockSuccess, setAdUnlockSuccess] =
  useState("");
  // ===================================================
  // ADMIN - MANAGE FILMS
  // ===================================================

  const [
    adminEditingFilm,
    setAdminEditingFilm,
  ] = useState(null);

  const [
    adminEditTitle,
    setAdminEditTitle,
  ] = useState("");

  const [
    adminEditDescription,
    setAdminEditDescription,
  ] = useState("");

  const [
    adminEditCategory,
    setAdminEditCategory,
  ] = useState("");

  const [
    adminEditPrice,
    setAdminEditPrice,
  ] = useState("");

  const [
    adminEditFeatured,
    setAdminEditFeatured,
  ] = useState(false);

  const [
    adminFilmSearch,
    setAdminFilmSearch,
  ] = useState("");

  const [
    adminSavingFilm,
    setAdminSavingFilm,
  ] = useState(false);

  const [
    adminManageError,
    setAdminManageError,
  ] = useState("");

  const [
    adminManageSuccess,
    setAdminManageSuccess,
  ] = useState("");

  // ===================================================
  // ADMIN BUNNY UPLOAD
  // ===================================================

  const [
    adminFilmId,
    setAdminFilmId,
  ] = useState("");

  const [
    adminVideoFile,
    setAdminVideoFile,
  ] = useState(null);

  const [
    uploadProgress,
    setUploadProgress,
  ] = useState(0);

  const [uploading, setUploading] =
    useState(false);

  const [
    uploadError,
    setUploadError,
  ] = useState("");

  const [
    uploadSuccess,
    setUploadSuccess,
  ] = useState("");

  // ===================================================
  // ADMIN TRAILER UPLOAD
  // ===================================================

  const [
    trailerVideoFile,
    setTrailerVideoFile,
  ] = useState(null);

  const [
    trailerUploading,
    setTrailerUploading,
  ] = useState(false);

  const [
    trailerUploadProgress,
    setTrailerUploadProgress,
  ] = useState(0);

  const [
    trailerUploadError,
    setTrailerUploadError,
  ] = useState("");

  const [
    trailerUploadSuccess,
    setTrailerUploadSuccess,
  ] = useState("");

  const [
    trailerStatus,
    setTrailerStatus,
  ] = useState(null);

  const [
    trailerStatusLoading,
    setTrailerStatusLoading,
  ] = useState(false);

  const [
    trailerStatusError,
    setTrailerStatusError,
  ] = useState("");

  // ===================================================
  // BUNNY STATUS
  // ===================================================

  const [
    bunnyStatus,
    setBunnyStatus,
  ] = useState(null);

  const [
    bunnyStatusLoading,
    setBunnyStatusLoading,
  ] = useState(false);

  const [
    bunnyStatusError,
    setBunnyStatusError,
  ] = useState("");

  // ===================================================
  // VIDEO
  // ===================================================

  const [
    videoError,
    setVideoError,
  ] = useState("");

  // ===================================================
  // WATCH PROGRESS / CONTINUE WATCHING
  // ===================================================

  const [
    watchProgress,
    setWatchProgress,
  ] = useState({});

  useEffect(() => {
    if (!user?.id) {
      setWatchProgress({});
      return;
    }

    try {
      const saved =
        localStorage.getItem(
          `nigfilm_watch_progress_${user.id}`
        );

      const parsed =
        saved ? JSON.parse(saved) : {};

      setWatchProgress(
        parsed &&
        typeof parsed === "object"
          ? parsed
          : {}
      );
    } catch {
      setWatchProgress({});
    }
  }, [user?.id]);

  const handleWatchProgressChange =
    useCallback(
      (filmId, progress) => {
        const id = Number(filmId);

        if (
          !Number.isInteger(id) ||
          id <= 0
        ) {
          return;
        }

        setWatchProgress(
          (current) => {
            const next = {
              ...current,
            };

            if (progress) {
              next[id] = progress;
            } else {
              delete next[id];
            }

            return next;
          }
        );
      },
      []
    );

  useEffect(() => {
    if (!user?.id) {
      return;
    }

    try {
      localStorage.setItem(
        `nigfilm_watch_progress_${user.id}`,
        JSON.stringify(
          watchProgress
        )
      );
    } catch {
      // Ignore browser storage failures.
    }
  }, [
    user?.id,
    watchProgress,
  ]);

  // ===================================================
  // CONTINUE WATCHING - REMOVE ONE / CLEAR ALL
  // ===================================================

  const removeFromContinueWatching =
    useCallback(
      (filmId) => {
        const id = Number(filmId);

        if (
          !Number.isInteger(id) ||
          id <= 0
        ) {
          return;
        }

        setWatchProgress(
          (current) => {
            const next = {
              ...current,
            };

            delete next[id];

            return next;
          }
        );
      },
      []
    );

  const clearContinueWatching =
    useCallback(() => {
      setWatchProgress({});
    }, []);

  const continueWatchingFilms =
    useMemo(() => {
      if (!user?.id) {
        return [];
      }

      return films
        .filter((film) => {
          const progress =
            watchProgress[
              Number(film.id)
            ];

          if (!progress) {
            return false;
          }

          const seconds =
            Number(
              progress.seconds || 0
            );

          const duration =
            Number(
              progress.duration || 0
            );

          if (
            !Number.isFinite(seconds) ||
            seconds < 10
          ) {
            return false;
          }

          if (
            duration > 0 &&
            seconds >=
              duration - 15
          ) {
            return false;
          }

          return true;
        })
        .sort((a, b) => {
          const aUpdated =
            Number(
              watchProgress[
                Number(a.id)
              ]?.updatedAt || 0
            );

          const bUpdated =
            Number(
              watchProgress[
                Number(b.id)
              ]?.updatedAt || 0
            );

          return (
            bUpdated -
            aUpdated
          );
        });
    }, [
      films,
      user?.id,
      watchProgress,
    ]);

  // ===================================================
  // INITIAL LOAD
  // ===================================================

  useEffect(() => {
    loadFilms();
  }, []);

  useEffect(() => {
    if (user?.id) {
      loadMyMovies(false);
      loadPremiumStatus();
    } else {
      setPremiumStatus(null);
      setPremiumError("");
      setPremiumLoading(false);

      setAdUnlockStatus(null);
      setAdUnlockError("");
      setAdUnlockSuccess("");
      setAdUnlockLoading(false);
      setAdWatchLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (
      !user?.id ||
      page !== "details" ||
      !selectedFilm?.id
    ) {
      return;
    }

    setAdUnlockStatus(null);
    setAdUnlockError("");
    setAdUnlockSuccess("");

    loadAdUnlockStatus(
      selectedFilm.id
    );
  }, [
    user?.id,
    page,
    selectedFilm?.id,
  ]);

  useEffect(() => {
    if (
      user?.id &&
      page === "premium"
    ) {
      loadPremiumPlans();
    }
  }, [user?.id, page]);

  useEffect(() => {
    if (!user) {
      navigationReadyRef.current = false;
      return;
    }

    if (!navigationReadyRef.current) {
      window.history.replaceState(
        pageState("home"),
        "",
        window.location.href
      );
      navigationReadyRef.current = true;
    }

    const handlePopState = (event) => {
      if (event.state?.nigfilm) {
        applyHistoryState(event.state);
        return;
      }

      // Prevent an accidental first Back from immediately leaving NIGFILM.
      const homeState = pageState("home");
      window.history.pushState(homeState, "", window.location.href);
      applyHistoryState(homeState);
    };

    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, [user?.id, films, myMovies]);

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

  function findPurchasedMovie(
    filmId
  ) {
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


  function trailerPlayerUrl(film) {
    if (!film || film.trailerEnabled === false) {
      return "";
    }

    if (film.trailerUrl) {
      return film.trailerUrl;
    }

    if (film.trailerBunnyVideoId) {
      return (
        `https://player.mediadelivery.net/embed/` +
        `${BUNNY_LIBRARY_ID}/` +
        `${film.trailerBunnyVideoId}`
      );
    }

    return "";
  }

  function handlePosterError(event) {
    if (event.currentTarget.src !== FALLBACK_POSTER) {
      event.currentTarget.src = FALLBACK_POSTER;
    }
  }

  // ===================================================
  // NAVIGATION
  // ===================================================

  function goHome() {
    navigateTo("home");
  }

  function goSearch() {
    navigateTo("home");

    setTimeout(() => {
      document
        .querySelector(".search-box input")
        ?.focus();
    }, 300);
  }

  function openFilm(film) {
    const movie = normalizeFilm(film);
    if (!movie) return;

    setWatchOptionsOpen(false);
    setTutorialOpen(false);
    navigateTo("details", movie);
  }

  // ===================================================
  // OPEN FULL CATEGORY FROM DASHBOARD
  // ===================================================

  function openFullCategory(category) {
    setSearch("");
    setActiveCategory(category);

    setTimeout(() => {
      document
        .getElementById("movies")
        ?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
    }, 50);
  }

  function openWatchOptionsAtButton(event) {
    const rect =
      event.currentTarget.getBoundingClientRect();

    const viewportWidth =
      window.innerWidth;

    const viewportHeight =
      window.innerHeight;

    const modalWidth =
      Math.min(
        370,
        viewportWidth - 24
      );

    const modalHeightEstimate =
      410;

    const halfWidth =
      modalWidth / 2;

    let left =
      rect.left +
      rect.width / 2;

    left =
      Math.max(
        halfWidth + 12,
        Math.min(
          left,
          viewportWidth -
            halfWidth -
            12
        )
      );

    let top =
      rect.bottom + 10;

    if (
      top +
        modalHeightEstimate >
      viewportHeight - 12
    ) {
      top =
        rect.top -
        modalHeightEstimate -
        10;
    }

    top =
      Math.max(
        12,
        Math.min(
          top,
          viewportHeight -
            modalHeightEstimate -
            12
        )
      );

    setWatchOptionsPosition({
      top,
      left,
    });

    setWatchOptionsOpen(true);
  }

  function openProfile() {
    navigateTo("profile");
  }

  function openPremium() {
    setPremiumSubscribeError("");
    navigateTo("premium");
  }

  function openMyMovies() {
    navigateTo("myMovies");
    loadMyMovies(false);
  }

  function goBack() {
    if (window.history.state?.nigfilm) {
      window.history.back();
      return;
    }

    navigateTo("home", null, { replace: true });
  }

  function openAdminUpload() {
    if (user?.role !== "ADMIN") {
      return;
    }

    setUploadError("");
    setUploadSuccess("");
    setUploadProgress(0);
    setBunnyStatus(null);
    setBunnyStatusError("");

    setTrailerVideoFile(null);
    setTrailerUploading(false);
    setTrailerUploadProgress(0);
    setTrailerUploadError("");
    setTrailerUploadSuccess("");
    setTrailerStatus(null);
    setTrailerStatusError("");

    navigateTo("adminUpload");
  }

  function openAdminManageFilms() {
    if (user?.role !== "ADMIN") {
      return;
    }

    setAdminEditingFilm(null);
    setAdminFilmSearch("");
    setAdminManageError("");
    setAdminManageSuccess("");

    navigateTo("adminManageFilms");
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
        error?.message ||
          "An samu matsala wajen ɗauko fina-finai."
      );
    } finally {
      setFilmsLoading(false);
    }
  }

  // ===================================================
  // REGISTER
  // ===================================================

  async function handleRegister(
    event
  ) {
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
        JSON.stringify(
          data.user
        )
      );

      if (
        data?.session?.token
      ) {
        localStorage.setItem(
          "nigfilm_session_token",
          data.session.token
        );
      }

      setUser(data.user);

      setPassword("");

      setPage("home");
    } catch (error) {
      console.error(
        "REGISTER ERROR:",
        error
      );

      setAuthError(
        error?.message ||
          "Register bai yi nasara ba."
      );
    } finally {
      setAuthLoading(false);
    }
  }

  // ===================================================
  // LOGIN
  // ===================================================

  async function handleLogin(
    event
  ) {
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

      if (
        !data?.session?.token
      ) {
        throw new Error(
          "Backend bai dawo da session token ba."
        );
      }

      localStorage.setItem(
        "nigfilm_user",
        JSON.stringify(
          data.user
        )
      );

      localStorage.setItem(
        "nigfilm_session_token",
        data.session.token
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
        error?.message ||
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

    localStorage.removeItem(
      "nigfilm_session_token"
    );

    setUser(null);
    setMyMovies([]);

    setSelectedFilm(null);

    setFullName("");
    setPhone("");
    setPassword("");

    setAuthMode("login");
    setPage("home");

    navigationReadyRef.current = false;
    window.history.replaceState(
      null,
      "",
      window.location.href
    );

    setAdminFilmId("");
    setAdminVideoFile(null);

    setBunnyStatus(null);
    setUploadProgress(0);

    setPremiumStatus(null);
    setPremiumError("");
    setPremiumLoading(false);
    setPremiumPlans([]);
    setPremiumPlansLoading(false);
    setPremiumSubscribeLoading("");
    setPremiumSubscribeError("");
    setWatchOptionsOpen(false);
    setTutorialOpen(false);
    setWatchProgress({});

    setAdUnlockStatus(null);
    setAdUnlockError("");
    setAdUnlockSuccess("");
    setAdUnlockLoading(false);
    setAdWatchLoading(false);
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
      openMyMovies();
      return;
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
        error?.message ||
          "An samu matsala wajen ɗauko fina-finan da ka saya."
      );
    } finally {
      setMyMoviesLoading(false);
    }
  }

  // ===================================================
  // LOAD PREMIUM STATUS
  // ===================================================

  async function loadPremiumStatus() {
    const token =
      getSessionToken();

    if (!user?.id || !token) {
      setPremiumStatus(null);
      setPremiumError("");
      return;
    }

    try {
      setPremiumLoading(true);
      setPremiumError("");

      const response =
        await fetch(
          `${API_URL}/api/web/premium/status`,
          {
            headers: {
              Authorization:
                `Bearer ${token}`,
            },
          }
        );

      const data =
        await readJson(response);

      if (!response.ok) {
        throw new Error(
          data?.message ||
            "An kasa duba Premium status."
        );
      }

      setPremiumStatus({
        premium:
          Boolean(data?.premium),

        subscription:
          data?.subscription ||
          null,
      });
    } catch (error) {
      console.error(
        "PREMIUM STATUS ERROR:",
        error
      );

      setPremiumStatus(null);

      setPremiumError(
        error?.message ||
          "An samu matsala wajen duba Premium."
      );
    } finally {
      setPremiumLoading(false);
    }
  }

  // ===================================================
  // LOAD PREMIUM PLANS
  // ===================================================

  async function loadPremiumPlans() {
    const token = getSessionToken();

    if (!user?.id || !token) {
      setPremiumPlans([]);
      return;
    }

    try {
      setPremiumPlansLoading(true);
      setPremiumSubscribeError("");

      const response = await fetch(
        `${API_URL}/api/web/premium/plans`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await readJson(response);

      if (!response.ok) {
        throw new Error(
          data?.message ||
            "An kasa dauko Premium plans."
        );
      }

      setPremiumPlans(
        Array.isArray(data?.plans)
          ? data.plans
          : []
      );
    } catch (error) {
      console.error(
        "PREMIUM PLANS ERROR:",
        error
      );

      setPremiumPlans([]);

      setPremiumSubscribeError(
        error?.message ||
          "An samu matsala wajen dauko Premium plans."
      );
    } finally {
      setPremiumPlansLoading(false);
    }
  }

  // ===================================================
  // START PREMIUM PAYMENT
  // ===================================================

  async function subscribePremium(planId) {
    const token = getSessionToken();

    if (!token || !planId) {
      return;
    }

    try {
      setPremiumSubscribeLoading(planId);
      setPremiumSubscribeError("");

      const response = await fetch(
        `${API_URL}/api/web/premium/initialize`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            plan: planId,
          }),
        }
      );

      const data = await readJson(response);

      if (!response.ok) {
        throw new Error(
          data?.message ||
            "An kasa fara Premium payment."
        );
      }

      if (!data?.authorizationUrl) {
        throw new Error(
          "Paystack Premium payment URL bai samu ba."
        );
      }

      window.location.href =
        data.authorizationUrl;
    } catch (error) {
      console.error(
        "PREMIUM SUBSCRIBE ERROR:",
        error
      );

      setPremiumSubscribeError(
        error?.message ||
          "An samu matsala wajen bude Premium payment."
      );
    } finally {
      setPremiumSubscribeLoading("");
    }
  }
  // ===================================================
  // LOAD AD UNLOCK STATUS
  // ===================================================

  async function loadAdUnlockStatus(filmId) {
    const token = getSessionToken();
    const id = Number(filmId);

    if (
      !token ||
      !Number.isInteger(id) ||
      id <= 0
    ) {
      setAdUnlockStatus(null);
      return null;
    }

    try {
      setAdUnlockLoading(true);
      setAdUnlockError("");

      const response = await fetch(
        `${API_URL}/api/web/ads/unlock-status/${id}`,
        {
          headers: {
            Authorization:
              `Bearer ${token}`,
          },
        }
      );

      const data =
        await readJson(response);

      if (!response.ok) {
        throw new Error(
          data?.message ||
            "An kasa duba matsayin talla."
        );
      }

      const normalized = {
        ...data,
        filmId: Number(
          data?.filmId || id
        ),
        watchedAds: Number(
          data?.watchedAds || 0
        ),
        requiredAds: Number(
          data?.requiredAds || 5
        ),
        unlocked:
          Boolean(data?.unlocked),
        expiresAt:
          data?.expiresAt || null,
      };

      setAdUnlockStatus(
        normalized
      );

      return normalized;
    } catch (error) {
      console.error(
        "AD UNLOCK STATUS ERROR:",
        error
      );

      setAdUnlockStatus(null);

      setAdUnlockError(
        error?.message ||
          "An samu matsala wajen duba talla."
      );

      return null;
    } finally {
      setAdUnlockLoading(false);
    }
  }

  // ===================================================
  // COMPLETE REWARDED AD
  // ===================================================

  async function completeRewardedAd({
    filmId,
    attemptToken,
  }) {
    const token = getSessionToken();

    const response = await fetch(
      `${API_URL}/api/web/ads/complete-attempt`,
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json",

          Authorization:
            `Bearer ${token}`,
        },

        body: JSON.stringify({
          filmId:
            Number(filmId),

          attemptToken,
        }),
      }
    );

    const data =
      await readJson(response);

    if (!response.ok) {
      throw new Error(
        data?.message ||
          "An kasa tabbatar da reward ɗin talla."
      );
    }

    const normalized = {
      ...data,

      filmId:
        Number(filmId),

      watchedAds:
        Number(
          data?.watchedAds || 0
        ),

      requiredAds:
        Number(
          data?.requiredAds || 5
        ),

      unlocked:
        Boolean(data?.unlocked),

      expiresAt:
        data?.expiresAt || null,
    };

    setAdUnlockStatus(
      normalized
    );

    if (normalized.unlocked) {
      setAdUnlockSuccess(
        language === "HAUSA"
          ? "✅ Ka gama talla 5. An buɗe wannan film na awa 24."
          : "✅ You completed 5 ads. This movie is unlocked for 24 hours."
      );
    } else {
      setAdUnlockSuccess(
        language === "HAUSA"
          ? `✅ An kirga tallar. ${normalized.watchedAds}/${normalized.requiredAds} sun cika.`
          : `✅ Ad counted. ${normalized.watchedAds}/${normalized.requiredAds} completed.`
      );
    }

    return normalized;
  }

  // ===================================================
  // WATCH REAL GOOGLE REWARDED AD
  // ===================================================

  async function watchRewardedAd(filmId) {
    const token =
      getSessionToken();

    const id =
      Number(filmId);

    if (
      !token ||
      !Number.isInteger(id) ||
      id <= 0
    ) {
      return;
    }

    if (
      adUnlockStatus?.filmId === id &&
      adUnlockStatus?.unlocked
    ) {
      setAdUnlockSuccess(
        language === "HAUSA"
          ? "✅ Wannan film a buɗe yake yanzu."
          : "✅ This movie is already unlocked."
      );
      return;
    }

    if (
      !REWARDED_AD_UNIT_PATH
    ) {
      setAdUnlockError(
        language === "HAUSA"
          ? "Google Rewarded Ad Unit Path bai saita ba tukuna."
          : "Google Rewarded Ad Unit Path is not configured yet."
      );
      return;
    }

    try {
      setAdWatchLoading(true);
      setAdUnlockError("");
      setAdUnlockSuccess("");

      await loadGooglePublisherTag();

      await new Promise(
        (resolve, reject) => {
          window.googletag.cmd.push(
            () => {
              const googletag =
                window.googletag;

              let rewardedSlot =
                googletag.defineOutOfPageSlot(
                  REWARDED_AD_UNIT_PATH,
                  googletag.enums
                    .OutOfPageFormat
                    .REWARDED
                );

              if (!rewardedSlot) {
                reject(
                  new Error(
                    language === "HAUSA"
                      ? "Wannan browser/device bai goyi bayan rewarded ad ba."
                      : "Rewarded ads are not supported on this browser/device."
                  )
                );
                return;
              }

              rewardedSlot.addService(
                googletag.pubads()
              );

              let attemptToken = "";
              let rewardGranted = false;
              let completionPromise = null;
              let finished = false;

              const pubads =
                googletag.pubads();

              const cleanup = () => {
                if (finished) {
                  return;
                }

                finished = true;

                clearTimeout(
                  readyTimeout
                );

                try {
                  pubads.removeEventListener(
                    "rewardedSlotReady",
                    onRewardedReady
                  );

                  pubads.removeEventListener(
                    "rewardedSlotGranted",
                    onRewardedGranted
                  );

                  pubads.removeEventListener(
                    "rewardedSlotClosed",
                    onRewardedClosed
                  );

                  pubads.removeEventListener(
                    "slotRenderEnded",
                    onSlotRenderEnded
                  );

                  googletag.destroySlots(
                    [rewardedSlot]
                  );
                } catch {
                  // Ignore GPT cleanup differences.
                }

                rewardedSlot = null;
              };

              const fail = (
                error
              ) => {
                cleanup();
                reject(error);
              };

              async function startBackendAttempt() {
                const startResponse =
                  await fetch(
                    `${API_URL}/api/web/ads/start-attempt`,
                    {
                      method: "POST",

                      headers: {
                        "Content-Type":
                          "application/json",

                        Authorization:
                          `Bearer ${token}`,
                      },

                      body:
                        JSON.stringify({
                          filmId: id,
                        }),
                    }
                  );

                const startData =
                  await readJson(
                    startResponse
                  );

                if (
                  startData
                    ?.alreadyHasAccess ||
                  startData
                    ?.alreadyUnlocked
                ) {
                  const status =
                    await loadAdUnlockStatus(
                      id
                    );

                  if (
                    status?.unlocked
                  ) {
                    setAdUnlockSuccess(
                      language === "HAUSA"
                        ? "✅ Wannan film a buɗe yake yanzu."
                        : "✅ This movie is already unlocked."
                    );
                  }

                  return "";
                }

                if (
                  !startResponse.ok
                ) {
                  throw new Error(
                    startData?.message ||
                      "An kasa fara Ad attempt."
                  );
                }

                const rawToken =
                  String(
                    startData
                      ?.attemptToken ||
                      ""
                  ).trim();

                if (!rawToken) {
                  throw new Error(
                    "Backend bai dawo da Ad attempt token ba."
                  );
                }

                return rawToken;
              }

              async function onRewardedReady(
                event
              ) {
                if (
                  event.slot !==
                    rewardedSlot ||
                  finished
                ) {
                  return;
                }

                try {
                  attemptToken =
                    await startBackendAttempt();

                  if (!attemptToken) {
                    cleanup();
                    resolve();
                    return;
                  }

                  event.makeRewardedVisible();
                } catch (error) {
                  fail(error);
                }
              }

              function onRewardedGranted(
                event
              ) {
                if (
                  event.slot !==
                    rewardedSlot ||
                  finished ||
                  !attemptToken
                ) {
                  return;
                }

                rewardGranted = true;

                completionPromise =
                  completeRewardedAd({
                    filmId: id,
                    attemptToken,
                  });
              }

              async function onRewardedClosed(
                event
              ) {
                if (
                  event.slot !==
                    rewardedSlot ||
                  finished
                ) {
                  return;
                }

                try {
                  if (
                    rewardGranted &&
                    completionPromise
                  ) {
                    await completionPromise;
                  } else {
                    setAdUnlockSuccess(
                      language === "HAUSA"
                        ? "Ba a kirga talla ba saboda ba a kai ga reward ba."
                        : "The ad was not counted because the reward requirement was not reached."
                    );
                  }

                  cleanup();
                  resolve();
                } catch (error) {
                  fail(error);
                }
              }

              function onSlotRenderEnded(
                event
              ) {
                if (
                  event.slot ===
                    rewardedSlot &&
                  event.isEmpty
                ) {
                  fail(
                    new Error(
                      language === "HAUSA"
                        ? "Babu rewarded ad da aka samu yanzu. Ka sake gwadawa daga baya."
                        : "No rewarded ad is available right now. Please try again later."
                    )
                  );
                }
              }

              pubads.addEventListener(
                "rewardedSlotReady",
                onRewardedReady
              );

              pubads.addEventListener(
                "rewardedSlotGranted",
                onRewardedGranted
              );

              pubads.addEventListener(
                "rewardedSlotClosed",
                onRewardedClosed
              );

              pubads.addEventListener(
                "slotRenderEnded",
                onSlotRenderEnded
              );

              const readyTimeout =
                setTimeout(() => {
                  fail(
                    new Error(
                      language === "HAUSA"
                        ? "Rewarded ad bai shirya ba. Ka sake gwadawa."
                        : "The rewarded ad did not become ready. Please try again."
                    )
                  );
                }, 20000);

              googletag.enableServices();

              googletag.display(
                rewardedSlot
              );
            }
          );
        }
      );

      await loadAdUnlockStatus(
        id
      );
    } catch (error) {
      console.error(
        "WATCH REWARDED AD ERROR:",
        error
      );

      setAdUnlockError(
        error?.message ||
          "An samu matsala wajen nuna rewarded ad."
      );
    } finally {
      setAdWatchLoading(false);
    }
  }

  // ===================================================
  // BUY MOVIE
  // ===================================================

  async function buyMovie(
    film
  ) {
    if (!user?.id) {
      return;
    }

    if (
      isPurchased(film.id)
    ) {
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

      if (
        !data.authorizationUrl
      ) {
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
        error?.message ||
          "An samu matsala wajen buɗe Paystack."
      );
    } finally {
      setPaymentLoading(false);
    }
  }

  // ===================================================
  // DIRECT MOVIE DOWNLOAD
  // ===================================================

  function downloadMovie(
    film
  ) {
    if (!user?.id) {
      return;
    }

    if (
  !isPurchased(film.id) &&
  !hasPremium
) {
  setVideoError(
    "Sai ka sayi film ko ka kunna Premium kafin download."
  );

  return;
}
    setVideoError("");

    const downloadUrl =
      `${API_URL}/api/web/movies/` +
      `${film.id}/download` +
      `?webUserId=${user.id}`;

    const anchor =
      document.createElement(
        "a"
      );

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
  // ADMIN - LOAD BUNNY STATUS
  // ===================================================

  async function loadBunnyStatus(
    filmId
  ) {
    const id =
      Number(filmId);

    if (
      !Number.isInteger(id) ||
      id <= 0
    ) {
      setBunnyStatus(null);

      return;
    }

    try {
      setBunnyStatusLoading(
        true
      );

      setBunnyStatusError("");

      const response =
        await fetch(
          `${API_URL}/api/admin/bunny/status/${id}`,
          {
            headers: {
              Authorization:
                `Bearer ${getSessionToken()}`,
            },
          }
        );

      const data =
        await readJson(response);

      if (!response.ok) {
        throw new Error(
          data?.message ||
            "An kasa duba Bunny status."
        );
      }

      setBunnyStatus(
        data?.bunny || null
      );
    } catch (error) {
      console.error(
        "BUNNY STATUS ERROR:",
        error
      );

      setBunnyStatus(null);

      setBunnyStatusError(
        error?.message ||
          "An samu matsala wajen duba status."
      );
    } finally {
      setBunnyStatusLoading(
        false
      );
    }
  }

  // ===================================================
  // ADMIN - REPLACE VIDEO
  // ===================================================

  async function replaceFilmOnBunny() {
    const filmId =
      Number(adminFilmId);

    if (
      !Number.isInteger(filmId) ||
      filmId <= 0
    ) {
      setUploadError(
        "Ka zaɓi film da farko."
      );

      return;
    }

    if (!adminVideoFile) {
      setUploadError(
        "Ka zaɓi sabon video da za a saka."
      );

      return;
    }

    try {
      setUploading(true);

      setUploadProgress(0);

      setUploadError("");
      setUploadSuccess("");

      // ===============================================
      // PREPARE REPLACE
      // ===============================================

      const response =
        await fetch(
          `${API_URL}/api/admin/bunny/prepare-replace`,
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",

              Authorization:
                `Bearer ${getSessionToken()}`,
            },

            body: JSON.stringify({
              filmId,
            }),
          }
        );

      const data =
        await readJson(response);

      if (!response.ok) {
        throw new Error(
          data?.message ||
            "An kasa shirya Replace Video."
        );
      }

      const uploadInfo =
        data?.upload;

      if (
        !uploadInfo?.endpoint ||
        !uploadInfo?.libraryId ||
        !uploadInfo?.videoId ||
        !uploadInfo
          ?.authorizationSignature ||
        !uploadInfo
          ?.authorizationExpire
      ) {
        throw new Error(
          "Backend bai dawo da cikakken Bunny Replace credentials ba."
        );
      }

      // ===============================================
      // TUS REPLACE
      // ===============================================

      const upload =
        new tus.Upload(
          adminVideoFile,
          {
            endpoint:
              uploadInfo.endpoint,

            retryDelays: [
              0,
              3000,
              5000,
              10000,
              20000,
            ],

            headers: {
              AuthorizationSignature:
                uploadInfo
                  .authorizationSignature,

              AuthorizationExpire:
                uploadInfo
                  .authorizationExpire,

              VideoId:
                uploadInfo.videoId,

              LibraryId:
                uploadInfo.libraryId,
            },

            metadata: {
              filetype:
                adminVideoFile.type ||
                "video/mp4",

              title:
                adminVideoFile.name,
            },

            onError(error) {
              console.error(
                "BUNNY REPLACE ERROR:",
                error
              );

              setUploading(false);

              setUploadError(
                error?.message ||
                  "Replace Video bai yi nasara ba."
              );
            },

            onProgress(
              bytesUploaded,
              bytesTotal
            ) {
              const percentage =
                bytesTotal > 0
                  ? (
                      (bytesUploaded /
                        bytesTotal) *
                      100
                    ).toFixed(1)
                  : 0;

              setUploadProgress(
                Number(
                  percentage
                )
              );
            },

            onSuccess() {
              setUploading(false);

              setUploadProgress(
                100
              );

              setUploadSuccess(
                `✅ "${data?.film?.title || adminVideoFile.name}" an maye gurbin video ɗinsa cikin nasara. Bunny zai sake transcoding.`
              );

              setAdminVideoFile(
                null
              );

              loadBunnyStatus(
                filmId
              );
            },
          }
        );

      const previousUploads =
        await upload.findPreviousUploads();

      if (
        previousUploads.length >
        0
      ) {
        upload.resumeFromPreviousUpload(
          previousUploads[0]
        );
      }

      upload.start();
    } catch (error) {
      console.error(
        "REPLACE VIDEO ERROR:",
        error
      );

      setUploading(false);

      setUploadError(
        error?.message ||
          "An samu matsala wajen Replace Video."
      );
    }
  }

  // ===================================================
  // ADMIN - UPLOAD VIDEO TO BUNNY
  // ===================================================

  async function uploadFilmToBunny() {
    const filmId =
      Number(adminFilmId);

    if (
      !Number.isInteger(filmId) ||
      filmId <= 0
    ) {
      setUploadError(
        "Ka zaɓi film da farko."
      );

      return;
    }

    if (!adminVideoFile) {
      setUploadError(
        "Ka zaɓi video/file da za a upload."
      );

      return;
    }

    try {
      setUploading(true);

      setUploadProgress(0);

      setUploadError("");
      setUploadSuccess("");

      // ===============================================
      // PREPARE UPLOAD
      // ===============================================

      const response =
        await fetch(
          `${API_URL}/api/admin/bunny/prepare-upload`,
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",

              Authorization:
                `Bearer ${getSessionToken()}`,
            },

            body: JSON.stringify({
              filmId,
            }),
          }
        );

      const data =
        await readJson(response);

      if (!response.ok) {
        throw new Error(
          data?.message ||
            "An kasa shirya Bunny upload."
        );
      }

      const uploadInfo =
        data?.upload;

      if (
        !uploadInfo?.endpoint ||
        !uploadInfo?.libraryId ||
        !uploadInfo?.videoId ||
        !uploadInfo
          ?.authorizationSignature ||
        !uploadInfo
          ?.authorizationExpire
      ) {
        throw new Error(
          "Backend bai dawo da cikakken Bunny upload credentials ba."
        );
      }

      // ===============================================
      // TUS UPLOAD
      // ===============================================

      const upload =
        new tus.Upload(
          adminVideoFile,
          {
            endpoint:
              uploadInfo.endpoint,

            retryDelays: [
              0,
              3000,
              5000,
              10000,
              20000,
            ],

            headers: {
              AuthorizationSignature:
                uploadInfo
                  .authorizationSignature,

              AuthorizationExpire:
                uploadInfo
                  .authorizationExpire,

              VideoId:
                uploadInfo.videoId,

              LibraryId:
                uploadInfo.libraryId,
            },

            metadata: {
              filetype:
                adminVideoFile.type ||
                "video/mp4",

              title:
                adminVideoFile.name,
            },

            onError(error) {
              console.error(
                "BUNNY TUS UPLOAD ERROR:",
                error
              );

              setUploading(false);

              setUploadError(
                error?.message ||
                  "Upload bai yi nasara ba."
              );
            },

            onProgress(
              bytesUploaded,
              bytesTotal
            ) {
              const percentage =
                bytesTotal > 0
                  ? (
                      (bytesUploaded /
                        bytesTotal) *
                      100
                    ).toFixed(1)
                  : 0;

              setUploadProgress(
                Number(
                  percentage
                )
              );
            },

            onSuccess() {
              setUploading(false);

              setUploadProgress(
                100
              );

              setUploadSuccess(
                `✅ "${data?.film?.title || adminVideoFile.name}" ya shiga Bunny Stream. Bunny zai fara transcoding.`
              );

              setAdminVideoFile(
                null
              );

              loadBunnyStatus(
                filmId
              );
            },
          }
        );

      const previousUploads =
        await upload.findPreviousUploads();

      if (
        previousUploads.length >
        0
      ) {
        upload.resumeFromPreviousUpload(
          previousUploads[0]
        );
      }

      upload.start();
    } catch (error) {
      console.error(
        "ADMIN UPLOAD ERROR:",
        error
      );

      setUploading(false);

      setUploadError(
        error?.message ||
          "An samu matsala wajen upload."
      );
    }
  }

  // ===================================================
  // ADMIN - OPEN FILM EDITOR
  // ===================================================

  function openAdminFilmEditor(film) {
    if (!film?.id) {
      return;
    }

    setAdminEditingFilm(film);
    setAdminEditTitle(film.title || "");
    setAdminEditDescription(film.description || "");
    setAdminEditCategory(film.category || "");
    setAdminEditPrice(String(film.price ?? ""));
    setAdminEditFeatured(Boolean(film.featured));
    setAdminManageError("");
    setAdminManageSuccess("");
  }

  // ===================================================
  // ADMIN - CLOSE FILM EDITOR
  // ===================================================

  function closeAdminFilmEditor() {
    if (adminSavingFilm) {
      return;
    }

    setAdminEditingFilm(null);
    setAdminEditTitle("");
    setAdminEditDescription("");
    setAdminEditCategory("");
    setAdminEditPrice("");
    setAdminEditFeatured(false);
    setAdminManageError("");
    setAdminManageSuccess("");
  }

  // ===================================================
  // ADMIN - SAVE FILM CHANGES
  // ===================================================

  async function saveAdminFilmChanges() {
    if (!adminEditingFilm?.id) {
      setAdminManageError("Ka zaɓi film da za ka gyara.");
      return;
    }

    const title = adminEditTitle.trim();
    const description = adminEditDescription.trim();
    const category = adminEditCategory.trim();
    const price = Number(adminEditPrice);

    if (!title) {
      setAdminManageError("Ka rubuta sunan film.");
      return;
    }

    if (!description) {
      setAdminManageError("Ka rubuta bayanin film.");
      return;
    }

    if (!category) {
      setAdminManageError("Ka rubuta category.");
      return;
    }

    if (!Number.isInteger(price) || price < 0) {
      setAdminManageError("Ka saka price mai kyau.");
      return;
    }

    try {
      setAdminSavingFilm(true);
      setAdminManageError("");
      setAdminManageSuccess("");

      const response = await fetch(
        `${API_URL}/api/admin/films/${adminEditingFilm.id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${getSessionToken()}`,
          },
          body: JSON.stringify({
            title,
            description,
            category,
            price,
            featured: adminEditFeatured,
          }),
        }
      );

      const data = await readJson(response);

      if (!response.ok) {
        throw new Error(data?.message || "An kasa gyara film.");
      }

      const updatedFilm = normalizeFilm(data?.film);

      if (updatedFilm) {
        setFilms((currentFilms) =>
          currentFilms.map((film) =>
            Number(film.id) === Number(updatedFilm.id)
              ? { ...film, ...updatedFilm }
              : film
          )
        );

        setAdminEditingFilm(updatedFilm);
        setAdminEditTitle(updatedFilm.title || "");
        setAdminEditDescription(updatedFilm.description || "");
        setAdminEditCategory(updatedFilm.category || "");
        setAdminEditPrice(String(updatedFilm.price ?? ""));
        setAdminEditFeatured(Boolean(updatedFilm.featured));
      } else {
        await loadFilms();
      }

      setAdminManageSuccess(
        data?.message || "✅ An gyara film cikin nasara."
      );
    } catch (error) {
      console.error("ADMIN SAVE FILM ERROR:", error);
      setAdminManageError(
        error?.message || "An samu matsala wajen gyara film."
      );
    } finally {
      setAdminSavingFilm(false);
    }
  }

  // ===================================================
  // ADMIN - LOAD TRAILER STATUS
  // ===================================================

  async function loadTrailerStatus(filmId) {
    const id = Number(filmId);

    if (!Number.isInteger(id) || id <= 0) {
      setTrailerStatus(null);
      return;
    }

    try {
      setTrailerStatusLoading(true);
      setTrailerStatusError("");

      const response = await fetch(
        `${API_URL}/api/admin/bunny/trailer-status/${id}`,
        {
          headers: {
            Authorization: `Bearer ${getSessionToken()}`,
          },
        }
      );

      const data = await readJson(response);

      if (!response.ok) {
        throw new Error(
          data?.message ||
            "An kasa duba trailer status."
        );
      }

      setTrailerStatus(
        data?.trailer || null
      );
    } catch (error) {
      console.error(
        "TRAILER STATUS ERROR:",
        error
      );

      setTrailerStatus(null);
      setTrailerStatusError(
        error?.message ||
          "An samu matsala wajen duba trailer status."
      );
    } finally {
      setTrailerStatusLoading(false);
    }
  }

  // ===================================================
  // ADMIN - UPLOAD / REPLACE TRAILER
  // ===================================================

  async function uploadTrailerToBunny() {
    const filmId = Number(adminFilmId);

    if (!Number.isInteger(filmId) || filmId <= 0) {
      setTrailerUploadError(
        "Ka zaɓi film da farko."
      );
      return;
    }

    if (!trailerVideoFile) {
      setTrailerUploadError(
        "Ka zaɓi trailer video da za a upload."
      );
      return;
    }

    try {
      setTrailerUploading(true);
      setTrailerUploadProgress(0);
      setTrailerUploadError("");
      setTrailerUploadSuccess("");

      const selected = films.find(
        (film) =>
          Number(film.id) === filmId
      );

      const replacing = Boolean(
        selected?.trailerBunnyVideoId
      );

      const endpoint = replacing
        ? "/api/admin/bunny/prepare-trailer-replace"
        : "/api/admin/bunny/prepare-trailer-upload";

      const response = await fetch(
        `${API_URL}${endpoint}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${getSessionToken()}`,
          },
          body: JSON.stringify({ filmId }),
        }
      );

      const data = await readJson(response);

      if (!response.ok) {
        throw new Error(
          data?.message ||
            "An kasa shirya trailer upload."
        );
      }

      const uploadInfo = data?.upload;

      if (
        !uploadInfo?.endpoint ||
        !uploadInfo?.libraryId ||
        !uploadInfo?.videoId ||
        !uploadInfo?.authorizationSignature ||
        !uploadInfo?.authorizationExpire
      ) {
        throw new Error(
          "Backend bai dawo da cikakken trailer upload credentials ba."
        );
      }

      const upload = new tus.Upload(
        trailerVideoFile,
        {
          endpoint: uploadInfo.endpoint,
          retryDelays: [
            0,
            3000,
            5000,
            10000,
            20000,
          ],
          headers: {
            AuthorizationSignature:
              uploadInfo.authorizationSignature,
            AuthorizationExpire:
              uploadInfo.authorizationExpire,
            VideoId: uploadInfo.videoId,
            LibraryId: uploadInfo.libraryId,
          },
          metadata: {
            filetype:
              trailerVideoFile.type ||
              "video/mp4",
            title:
              trailerVideoFile.name,
          },
          onError(error) {
            console.error(
              "TRAILER TUS UPLOAD ERROR:",
              error
            );
            setTrailerUploading(false);
            setTrailerUploadError(
              error?.message ||
                "Trailer upload bai yi nasara ba."
            );
          },
          onProgress(
            bytesUploaded,
            bytesTotal
          ) {
            const percentage =
              bytesTotal > 0
                ? (
                    (bytesUploaded /
                      bytesTotal) *
                    100
                  ).toFixed(1)
                : 0;

            setTrailerUploadProgress(
              Number(percentage)
            );
          },
          onSuccess: async () => {
            try {
              const completeResponse =
                await fetch(
                  `${API_URL}/api/admin/bunny/trailer-upload-complete`,
                  {
                    method: "POST",
                    headers: {
                      "Content-Type":
                        "application/json",
                      Authorization:
                        `Bearer ${getSessionToken()}`,
                    },
                    body: JSON.stringify({
                      filmId,
                    }),
                  }
                );

              const completeData =
                await readJson(
                  completeResponse
                );

              if (!completeResponse.ok) {
                throw new Error(
                  completeData?.message ||
                    "Trailer ya upload amma an kasa kunna shi."
                );
              }

              setTrailerUploadProgress(100);
              setTrailerUploadSuccess(
                replacing
                  ? "✅ An maye gurbin trailer cikin nasara."
                  : "✅ Trailer ya shiga Bunny Stream kuma an kunna shi."
              );
              setTrailerVideoFile(null);

              await loadFilms();
              await loadTrailerStatus(
                filmId
              );
            } catch (error) {
              console.error(
                "TRAILER COMPLETE ERROR:",
                error
              );
              setTrailerUploadError(
                error?.message ||
                  "Trailer ya upload amma an samu matsala wajen kammalawa."
              );
            } finally {
              setTrailerUploading(false);
            }
          },
        }
      );

      const previousUploads =
        await upload.findPreviousUploads();

      if (previousUploads.length > 0) {
        upload.resumeFromPreviousUpload(
          previousUploads[0]
        );
      }

      upload.start();
    } catch (error) {
      console.error(
        "ADMIN TRAILER UPLOAD ERROR:",
        error
      );
      setTrailerUploading(false);
      setTrailerUploadError(
        error?.message ||
          "An samu matsala wajen trailer upload."
      );
    }
  }

  // ===================================================
  // ADMIN - ENABLE / DISABLE TRAILER
  // ===================================================

  async function toggleTrailerEnabled() {
    const filmId = Number(adminFilmId);

    if (!Number.isInteger(filmId) || filmId <= 0) {
      return;
    }

    try {
      setTrailerUploadError("");
      setTrailerUploadSuccess("");

      const enabled =
        !Boolean(trailerStatus?.enabled);

      const response = await fetch(
        `${API_URL}/api/admin/films/${filmId}/trailer-enabled`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${getSessionToken()}`,
          },
          body: JSON.stringify({
            enabled,
          }),
        }
      );

      const data = await readJson(response);

      if (!response.ok) {
        throw new Error(
          data?.message ||
            "An kasa canza trailer status."
        );
      }

      setTrailerUploadSuccess(
        enabled
          ? "✅ An kunna trailer."
          : "✅ An kashe trailer."
      );

      await loadFilms();
      await loadTrailerStatus(filmId);
    } catch (error) {
      console.error(
        "TOGGLE TRAILER ERROR:",
        error
      );
      setTrailerUploadError(
        error?.message ||
          "An samu matsala wajen canza trailer status."
      );
    }
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
              film.title ||
                ""
            ).toLowerCase();

          const description =
            String(
              film.description ||
                ""
            ).toLowerCase();

          const category =
            String(
              film.category ||
                ""
            )
              .trim()
              .toLowerCase();

          const matchesSearch =
            !query ||
            title.includes(query) ||
            description.includes(
              query
            ) ||
            category.includes(
              query
            );

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
                  placeholder="Full name"
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

                    setAuthError(
                      ""
                    );
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

                    setAuthError(
                      ""
                    );
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
          {timeGreeting()}, {user.fullName}
        </p>

        <h1>
          NIG<span>FILM</span>
        </h1>
      </div>

      <div className="header-actions">
        <button
          type="button"
          className="mini-control"
          title={t("language")}
          onClick={() =>
            setLanguage((current) =>
              current === "HAUSA" ? "ENGLISH" : "HAUSA"
            )
          }
        >
          {language === "HAUSA" ? "HA" : "EN"}
        </button>

        <button
          type="button"
          className="mini-control"
          title={t("theme")}
          onClick={() =>
            setTheme((current) =>
              current === "BLACK_GOLD" ? "WHITE_GOLD" : "BLACK_GOLD"
            )
          }
        >
          {theme === "BLACK_GOLD" ? "☾" : "☀"}
        </button>

        <button
          type="button"
          className="profile"
          title={t("profile")}
          onClick={openProfile}
        >
          👤
        </button>
      </div>
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

    const hasAdUnlock =
      Boolean(
        adUnlockStatus?.unlocked &&
        Number(
          adUnlockStatus?.filmId
        ) ===
          Number(
            selectedFilm.id
          )
      );

    const canWatchMovie =
      purchased ||
      hasPremium ||
      hasAdUnlock;

    const purchasedFilm =
      findPurchasedMovie(
        selectedFilm.id
      );

    const movie =
      purchasedFilm ||
      selectedFilm;

    const playerUrl =
      canWatchMovie
        ? bunnyPlayerUrl(movie)
        : "";

    const relatedMovies =
      films
        .filter((film) => {
          if (
            Number(film.id) ===
            Number(movie.id)
          ) {
            return false;
          }

          const currentCategory =
            String(
              movie.category || ""
            )
              .trim()
              .toLowerCase();

          const filmCategory =
            String(
              film.category || ""
            )
              .trim()
              .toLowerCase();

          return (
            currentCategory &&
            filmCategory ===
              currentCategory
          );
        })
        .slice(0, 8);

    return (
      <div className="app movie-details-page">
        {header}

        <main className="movie-details">
          <button
            type="button"
            className="back-button"
            onClick={
              goBack
            }
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
                onError={handlePosterError}
              />

              <span className="details-price-badge">
                {purchased
                  ? "✅ OWNED"
                  : "🔒 ACCESS"}
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

                {hasPremium && (
                  <span>
                    👑 Premium Active
                  </span>
                )}

                {hasAdUnlock && (
                  <span>
                    📺 Ads Unlock Active
                  </span>
                )}
              </div>

              <p className="details-description">
                {movie.description ||
                  "Babu cikakken bayanin wannan film tukuna."}
              </p>

              {!canWatchMovie &&
                trailerPlayerUrl(movie) && (
                  <div className="trailer-panel">
                    <div className="trailer-panel-heading">
                      <span>🎞️</span>
                      <strong>{t("trailer")}</strong>
                    </div>

                    <div className="bunny-player trailer-player">
                      <iframe
                        src={trailerPlayerUrl(movie)}
                        title={`${movie.title} trailer`}
                        loading="lazy"
                        allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture"
                        allowFullScreen
                      />
                    </div>
                  </div>
                )}

              {canWatchMovie && playerUrl && (
                <BunnyMoviePlayer
                  src={playerUrl}
                  title={movie.title}
                  filmId={movie.id}
                  userId={user?.id}
                  language={language}
                  onProgressChange={
                    handleWatchProgressChange
                  }
                />
              )}

              {canWatchMovie && !playerUrl && (
                <div className="movie-security-note">
                  ⏳ Video ɗin wannan film bai shirya a Bunny Stream ba tukuna.
                </div>
              )}

              {videoError && (
                <div className="auth-error">
                  {videoError}
                </div>
              )}

              {paymentError && (
                <div className="auth-error">
                  {paymentError}
                </div>
              )}

              {adUnlockError && (
                <div className="auth-error">
                  {adUnlockError}
                </div>
              )}

              {adUnlockSuccess && (
                <div className="admin-upload-success">
                  {adUnlockSuccess}
                </div>
              )}

              {!purchased &&
                !hasPremium &&
                !hasAdUnlock &&
                adUnlockStatus && (
                  <div className="movie-security-note">
                    📺{" "}
                    {language === "HAUSA"
                      ? `Tallan da aka gama: ${adUnlockStatus.watchedAds || 0}/${adUnlockStatus.requiredAds || 5}`
                      : `Ads completed: ${adUnlockStatus.watchedAds || 0}/${adUnlockStatus.requiredAds || 5}`}
                  </div>
                )}

              <div className="details-actions">
                <button
                  type="button"
                  className="buy-now-button watch-options-main-button"
                  onClick={
                    openWatchOptionsAtButton
                  }
                >
                  ▶ WATCH OPTIONS
                </button>

                <button
                  type="button"
                  className="secondary-button"
                  onClick={openMyMovies}
                >
                  🎬 My Movies
                </button>

                <button
                  type="button"
                  className="secondary-button"
                  onClick={goHome}
                >
                  🎞️ More Movies
                </button>
              </div>

              <div className="movie-security-note">
                {purchased
                  ? "🔒 Wannan film yana cikin My Movies ɗinka. Za ka iya kallonsa ko sauke shi."
                  : hasPremium
                    ? "👑 Premium ɗinka yana aiki. Kana da damar kallon wannan film."
                    : hasAdUnlock
                      ? "📺 Ka gama tallan da ake buƙata. Wannan film a buɗe yake na awa 24."
                      : "🔒 Saya film, kunna Premium, ko kalli talla 5 domin samun damar kallon film."}
              </div>
            </div>
          </div>

          {relatedMovies.length > 0 && (
            <section
              style={{
                marginTop: "28px",
              }}
            >
              <div className="row-heading">
                <h3>
                  {language === "HAUSA"
                    ? "🎬 Makamantan Films"
                    : "🎬 More Like This"}
                </h3>

                <span>
                  {relatedMovies.length}
                </span>
              </div>

              <MovieRow
                films={relatedMovies}
                posterSrc={posterSrc}
                openFilm={openFilm}
                handlePosterError={
                  handlePosterError
                }
              />
            </section>
          )}
        </main>

        {watchOptionsOpen && (
          <div
            className="watch-options-backdrop"
            role="presentation"
            onClick={() =>
              setWatchOptionsOpen(false)
            }
          >
            <section
              className="watch-options-modal watch-options-popover"
              style={{
                top:
                  watchOptionsPosition.top,
                left:
                  watchOptionsPosition.left,
              }}
              role="dialog"
              aria-modal="true"
              aria-label="Watch options"
              onClick={(event) =>
                event.stopPropagation()
              }
            >
              <div className="watch-options-handle" />

              <div className="watch-options-header">
                <div className="watch-options-brand-icon">
                  ▶
                </div>

                <div>
                  <h3>NIGFILM</h3>
                  <p>
                    {language === "HAUSA"
                      ? "Zaɓi yadda kake son kallon wannan film"
                      : "Choose how you want to watch this movie"}
                  </p>
                </div>

                <button
                  type="button"
                  className="watch-options-close"
                  onClick={() =>
                    setWatchOptionsOpen(false)
                  }
                  aria-label="Close"
                >
                  ×
                </button>
              </div>

              <div className="watch-options-list">
                {canWatchMovie ? (
                  <>
                    {playerUrl && (
                      <button
                        type="button"
                        className="watch-option-card premium-option"
                        onClick={() => {
                          setWatchOptionsOpen(false);
                          setTimeout(() => {
                            document
                              .querySelector(
                                ".bunny-player:not(.trailer-player)"
                              )
                              ?.scrollIntoView({
                                behavior: "smooth",
                                block: "center",
                              });
                          }, 80);
                        }}
                      >
                        <span className="watch-option-icon">▶</span>
                        <span className="watch-option-copy">
                          <strong>Watch Movie</strong>
                          <small>
                            {language === "HAUSA"
                              ? purchased
                                ? "Film ɗin yana cikin My Movies ɗinka."
                                : hasPremium
                                  ? "Premium ɗinka yana ba ka damar kallon film."
                                  : "Ka buɗe film ɗin ta hanyar kallon talla 5."
                              : purchased
                                ? "This movie is in your library."
                                : hasPremium
                                  ? "Your Premium gives you access to this movie."
                                  : "You unlocked this movie by watching 5 ads."}
                          </small>
                        </span>
                        <span className="watch-option-arrow">›</span>
                      </button>
                    )}

                    {(purchased ||
                      hasPremium) && (
                      <button
                        type="button"
                        className="watch-option-card buy-option"
                        onClick={() => {
                          setWatchOptionsOpen(false);
                          downloadMovie(movie);
                        }}
                      >
                        <span className="watch-option-icon">⬇</span>
                        <span className="watch-option-copy">
                          <strong>Download Movie</strong>
                          <small>
                            {language === "HAUSA"
                              ? "Sauke film ɗin zuwa na'urarka."
                              : "Download the movie to your device."}
                          </small>
                        </span>
                        <span className="watch-option-arrow">›</span>
                      </button>
                    )}
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      className="watch-option-card premium-option"
                      onClick={() => {
                        setWatchOptionsOpen(false);
                        openPremium();
                      }}
                    >
                      <span className="watch-option-icon">👑</span>
                      <span className="watch-option-copy">
                        <strong>
                          {hasPremium
                            ? "Premium Active"
                            : "Activate Premium"}
                        </strong>
                        <small>
                          {hasPremium
                            ? language === "HAUSA"
                              ? "Premium ɗinka yana aiki. Za ka iya duba plans ko ƙara lokaci."
                              : "Your Premium is active. View plans or extend it."
                            : language === "HAUSA"
                              ? "Zaɓi Weekly, Monthly ko Yearly Premium."
                              : "Choose Weekly, Monthly or Yearly Premium."}
                        </small>
                      </span>
                      <span className="watch-option-arrow">›</span>
                    </button>

                    <button
                      type="button"
                      className="watch-option-card buy-option"
                      disabled={paymentLoading}
                      onClick={() => {
                        setWatchOptionsOpen(false);
                        buyMovie(movie);
                      }}
                    >
                      <span className="watch-option-icon">💳</span>
                      <span className="watch-option-copy">
                        <strong>
                          {paymentLoading
                            ? "Opening Paystack..."
                            : `Buy This Movie — ₦${Number(
                                movie.price || 0
                              ).toLocaleString()}`}
                        </strong>
                        <small>
                          {language === "HAUSA"
                            ? "Biya sau ɗaya, film ya shiga My Movies."
                            : "Pay once and keep the movie in My Movies."}
                        </small>
                      </span>
                      <span className="watch-option-arrow">›</span>
                    </button>
                    <button
                      type="button"
                      className="watch-option-card ads-option"
                      disabled={
                        adWatchLoading ||
                        adUnlockLoading
                      }
                      onClick={() => {
                        watchRewardedAd(
                          movie.id
                        );
                      }}
                    >
                      <span className="watch-option-icon">
                        📺
                      </span>

                      <span className="watch-option-copy">
                        <strong>
                          {adWatchLoading
                            ? language === "HAUSA"
                              ? "Ana shirya talla..."
                              : "Preparing Ad..."
                            : "Watch 5 Ads & Unlock"}
                        </strong>

                        <small>
                          {language === "HAUSA"
                            ? `Kalli talla 5 ka buɗe wannan film na awa 24. ${adUnlockStatus?.watchedAds || 0}/${adUnlockStatus?.requiredAds || 5}`
                            : `Watch 5 ads to unlock this movie for 24 hours. ${adUnlockStatus?.watchedAds || 0}/${adUnlockStatus?.requiredAds || 5}`}
                        </small>
                      </span>

                      <span className="watch-option-arrow">
                        ›
                      </span>
                    </button>

                  </>
                )}

                <button
                  type="button"
                  className="watch-option-card tutorial-option"
                  onClick={() => {
                    setWatchOptionsOpen(false);
                    setTutorialOpen(true);
                  }}
                >
                  <span className="watch-option-icon">🎥</span>
                  <span className="watch-option-copy">
                    <strong>How to Buy / Activate Premium</strong>
                    <small>
                      {language === "HAUSA"
                        ? "Kalli tutorial na yadda ake siyan film ko kunna Premium."
                        : "Watch a guide on buying a movie or activating Premium."}
                    </small>
                  </span>
                  <span className="watch-option-arrow">›</span>
                </button>
              </div>
            </section>
          </div>
        )}

        {tutorialOpen && (
          <div
            className="watch-options-backdrop tutorial-backdrop"
            role="presentation"
            onClick={() =>
              setTutorialOpen(false)
            }
          >
            <section
              className="tutorial-modal"
              role="dialog"
              aria-modal="true"
              aria-label="NIGFILM tutorial"
              onClick={(event) =>
                event.stopPropagation()
              }
            >
              <div className="watch-options-handle" />

              <div className="watch-options-header">
                <div className="watch-options-brand-icon tutorial-brand-icon">
                  🎥
                </div>

                <div>
                  <h3>Video Tutorial</h3>
                  <p>
                    {language === "HAUSA"
                      ? "Yadda ake siyan film ko kunna Premium"
                      : "How to buy a movie or activate Premium"}
                  </p>
                </div>

                <button
                  type="button"
                  className="watch-options-close"
                  onClick={() =>
                    setTutorialOpen(false)
                  }
                  aria-label="Close"
                >
                  ×
                </button>
              </div>

              {TUTORIAL_VIDEO_URL ? (
                <div className="tutorial-video-frame">
                  <iframe
                    src={TUTORIAL_VIDEO_URL}
                    title="NIGFILM tutorial"
                    allow="autoplay; encrypted-media; picture-in-picture"
                    allowFullScreen
                  />
                </div>
              ) : (
                <div className="tutorial-fallback">
                  <div className="tutorial-step">
                    <span>1</span>
                    <div>
                      <strong>Buy This Movie</strong>
                      <p>
                        Watch Options → Buy This Movie → Paystack → My Movies.
                      </p>
                    </div>
                  </div>

                  <div className="tutorial-step">
                    <span>2</span>
                    <div>
                      <strong>Activate Premium</strong>
                      <p>
                        Watch Options → Activate Premium → Choose Plan → Paystack.
                      </p>
                    </div>
                  </div>

                  <div className="movie-security-note">
                    🎥 Idan ka saka VITE_TUTORIAL_VIDEO_URL a Vercel, video tutorial zai bayyana a nan kai tsaye.
                  </div>
                </div>
              )}
            </section>
          </div>
        )}

        <BottomNav
          page={page}
          goHome={goHome}
          goSearch={goSearch}
          loadMyMovies={
            openMyMovies
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

  if (
    page === "myMovies"
  ) {
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
                Loading your movies...
              </p>
            </div>
          )}

          {!myMoviesLoading &&
            myMoviesError && (
              <div className="status error">
                <p>
                  {
                    myMoviesError
                  }
                </p>

                <button
                  type="button"
                  onClick={() =>
                    loadMyMovies(
                      false
                    )
                  }
                >
                  Try Again.
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
                handlePosterError={handlePosterError}
              />
            )}
        </section>

        <BottomNav
          page={page}
          goHome={goHome}
          goSearch={goSearch}
          loadMyMovies={
            openMyMovies
          }
          openProfile={
            openProfile
          }
        />
      </div>
    );
  }

  // ===================================================
  // ADMIN SECURITY CHECK
  // ===================================================

  if (
    (
      page === "adminUpload" ||
      page === "adminManageFilms"
    ) &&
    user?.role !== "ADMIN"
  ) {
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
              <h2>
                ⛔ Access Denied
              </h2>

              <p className="details-description">
                Ba ka da izinin shiga
                Admin Panel.
              </p>

              <button
                type="button"
                className="secondary-button"
                onClick={
                  goHome
                }
              >
                ← Home
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // ===================================================
  // ADMIN MANAGE FILMS PAGE
  // ===================================================

  if (page === "adminManageFilms") {
    const adminFilteredFilms = films.filter((film) => {
      const query = adminFilmSearch.trim().toLowerCase();

      if (!query) {
        return true;
      }

      return (
        String(film.title || "").toLowerCase().includes(query) ||
        String(film.category || "").toLowerCase().includes(query) ||
        String(film.description || "").toLowerCase().includes(query)
      );
    });

    return (
      <div className="app">
        {header}

        <main className="movie-details">
          <button
            type="button"
            className="back-button"
            onClick={openProfile}
          >
            ← Back to Profile
          </button>

          <div className="movie-details-card">
            <div
              className="details-content"
              style={{ gridColumn: "1 / -1" }}
            >
              <p className="small-title">NIGFILM ADMIN</p>
              <h2>🎬 Manage Films</h2>

              <p className="details-description">
                Gyara title, description, category, price da Featured status na
                fina-finai.
              </p>

              <div className="admin-upload-field">
                <label htmlFor="admin-film-search">🔎 Search Movies</label>
                <input
                  id="admin-film-search"
                  type="text"
                  value={adminFilmSearch}
                  placeholder="Search by title, category..."
                  onChange={(event) => setAdminFilmSearch(event.target.value)}
                />
              </div>

              <div
                style={{
                  display: "grid",
                  gap: "12px",
                  marginTop: "20px",
                }}
              >
                {adminFilteredFilms.map((film) => (
                  <div key={film.id} className="admin-selected-film">
                    <img
                      src={posterSrc(film)}
                      alt={film.title}
                      onError={handlePosterError}
                    />

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <h3>{film.title}</h3>
                      <p>
                        {film.category || "Movie"} · ₦
                        {Number(film.price || 0).toLocaleString()}
                      </p>
                      <p>{film.featured ? "⭐ Featured" : "Not Featured"}</p>
                    </div>

                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => openAdminFilmEditor(film)}
                    >
                      ✏️ Edit
                    </button>
                  </div>
                ))}
              </div>

              {adminFilteredFilms.length === 0 && (
                <div className="status">
                  <p>Ba a samu film ba.</p>
                </div>
              )}

              {adminEditingFilm && (
                <div
                  style={{
                    marginTop: "30px",
                    paddingTop: "25px",
                    borderTop: "1px solid var(--border)",
                  }}
                >
                  <p className="small-title">EDIT MOVIE</p>
                  <h2 style={{ fontSize: "24px" }}>
                    ✏️ {adminEditingFilm.title}
                  </h2>

                  <div className="admin-upload-field">
                    <label>Movie Title</label>
                    <input
                      type="text"
                      value={adminEditTitle}
                      onChange={(event) => setAdminEditTitle(event.target.value)}
                    />
                  </div>

                  <div className="admin-upload-field">
                    <label>Description</label>
                    <textarea
                      value={adminEditDescription}
                      rows={5}
                      onChange={(event) =>
                        setAdminEditDescription(event.target.value)
                      }
                    />
                  </div>

                  <div className="admin-upload-field">
                    <label>Category</label>
                    <input
                      type="text"
                      value={adminEditCategory}
                      onChange={(event) =>
                        setAdminEditCategory(event.target.value)
                      }
                    />
                  </div>

                  <div className="admin-upload-field">
                    <label>Price (₦)</label>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={adminEditPrice}
                      onChange={(event) => setAdminEditPrice(event.target.value)}
                    />
                  </div>

                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      margin: "18px 0",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={adminEditFeatured}
                      onChange={(event) =>
                        setAdminEditFeatured(event.target.checked)
                      }
                    />
                    ⭐ Show in Featured Movies
                  </label>

                  {adminManageError && (
                    <div className="auth-error">❌ {adminManageError}</div>
                  )}

                  {adminManageSuccess && (
                    <div className="admin-upload-success">
                      {adminManageSuccess}
                    </div>
                  )}

                  <div className="details-actions">
                    <button
                      type="button"
                      className="buy-now-button"
                      disabled={adminSavingFilm}
                      onClick={saveAdminFilmChanges}
                    >
                      {adminSavingFilm ? "💾 Saving..." : "💾 Save Changes"}
                    </button>

                    <button
                      type="button"
                      className="secondary-button"
                      disabled={adminSavingFilm}
                      onClick={closeAdminFilmEditor}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    );
  }

  // ===================================================
  // ADMIN BUNNY UPLOAD PAGE
  // ===================================================

  if (
    page === "adminUpload"
  ) {
    const selectedAdminFilm =
      films.find(
        (film) =>
          Number(film.id) ===
          Number(adminFilmId)
      );

    return (
      <div className="app">
        {header}

        <main className="movie-details">
          <button
            type="button"
            className="back-button"
            onClick={
              openProfile
            }
          >
            ← Back to Profile
          </button>

          <div className="movie-details-card">
            <div
              className="details-content"
              style={{
                gridColumn:
                  "1 / -1",
              }}
            >
              <p className="small-title">
                NIGFILM ADMIN
              </p>

              <h2>
                🐰 Bunny Video Upload
              </h2>

              <p className="details-description">
                Zaɓi film daga database,
                sannan ka zaɓi video daga
                laptop domin upload kai
                tsaye zuwa Bunny Stream.
              </p>

              <div className="admin-upload-field">
                <label htmlFor="admin-film">
                  🎬 Select Movie
                </label>

                <select
                  id="admin-film"
                  value={
                    adminFilmId
                  }
                  disabled={
                    uploading
                  }
                  onChange={(
                    event
                  ) => {
                    const filmId =
                      event.target
                        .value;

                    setAdminFilmId(
                      filmId
                    );

                    setUploadError(
                      ""
                    );

                    setUploadSuccess(
                      ""
                    );

                    setUploadProgress(
                      0
                    );

                    setBunnyStatus(
                      null
                    );

                    setBunnyStatusError(
                      ""
                    );

                    setTrailerVideoFile(
                      null
                    );
                    setTrailerUploadProgress(
                      0
                    );
                    setTrailerUploadError(
                      ""
                    );
                    setTrailerUploadSuccess(
                      ""
                    );
                    setTrailerStatus(
                      null
                    );
                    setTrailerStatusError(
                      ""
                    );

                    if (filmId) {
                      loadBunnyStatus(
                        filmId
                      );
                      loadTrailerStatus(
                        filmId
                      );
                    }
                  }}
                >
                  <option value="">
                    -- Choose Movie --
                  </option>

                  {films.map(
                    (film) => (
                      <option
                        key={
                          film.id
                        }
                        value={
                          film.id
                        }
                      >
                        #
                        {
                          film.id
                        }{" "}
                        —{" "}
                        {
                          film.title
                        }
                      </option>
                    )
                  )}
                </select>
              </div>

              {selectedAdminFilm && (
                <div className="admin-selected-film">
                  <img
                    src={posterSrc(
                      selectedAdminFilm
                    )}
                    alt={
                      selectedAdminFilm.title
                    }
                  />

                  <div>
                    <small>
                      SELECTED MOVIE
                    </small>

                    <h3>
                      {
                        selectedAdminFilm.title
                      }
                    </h3>

                    <p>
                      Film ID:{" "}
                      {
                        selectedAdminFilm.id
                      }
                    </p>

                    <p>
                      Category:{" "}
                      {selectedAdminFilm.category ||
                        "Movie"}
                    </p>

                    <p>
                      Price: ₦
                      {Number(
                        selectedAdminFilm.price ||
                          0
                      ).toLocaleString()}
                    </p>

                    <div className="admin-bunny-status">
                      {!bunnyStatus &&
                        !bunnyStatusLoading && (
                          <p>
                            Bunny:{" "}
                            {selectedAdminFilm.bunnyVideoId
                              ? "✅ Connected"
                              : "⏳ Not connected"}
                          </p>
                        )}

                      {bunnyStatusLoading && (
                        <p>
                          🔄 Ana duba Bunny status...
                        </p>
                      )}

                      {bunnyStatus && (
                        <>
                          <p>
                            Bunny:{" "}
                            {bunnyStatus.connected
                              ? "✅ Connected"
                              : "⏳ Not connected"}
                          </p>

                          <p>
                            Status:{" "}
                            <strong>
                              {bunnyStatus.ready
                                ? "✅ Ready"
                                : bunnyStatus.failed
                                  ? "❌ Failed"
                                  : bunnyStatus.label ||
                                    "Unknown"}
                            </strong>
                          </p>

                          {bunnyStatus.connected && (
                            <p>
                              Progress:{" "}
                              {Number(
                                bunnyStatus.progress ||
                                  0
                              ).toFixed(
                                0
                              )}
                              %
                            </p>
                          )}

                          {bunnyStatus
                            .resolutions
                            ?.length >
                            0 && (
                            <p>
                              Resolutions:{" "}
                              {bunnyStatus.resolutions.join(
                                ", "
                              )}
                            </p>
                          )}
                        </>
                      )}

                      {bunnyStatusError && (
                        <p className="admin-status-error">
                          ❌{" "}
                          {
                            bunnyStatusError
                          }
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {selectedAdminFilm && (
                <div className="details-actions">
                  <button
                    type="button"
                    className="secondary-button"
                    disabled={
                      bunnyStatusLoading ||
                      uploading
                    }
                    onClick={() =>
                      loadBunnyStatus(
                        selectedAdminFilm.id
                      )
                    }
                  >
                    {bunnyStatusLoading
                      ? "🔄 Checking..."
                      : "🔄 Refresh Status"}
                  </button>
                </div>
              )}

              <div className="admin-upload-field">
                <label htmlFor="admin-video">
                  📁 Select Video
                </label>

                <input
                  id="admin-video"
                  type="file"
                  accept="video/*,.mp4,.mkv,.mov,.avi"
                  disabled={
                    uploading
                  }
                  onChange={(
                    event
                  ) => {
                    const file =
                      event.target
                        .files?.[0] ||
                      null;

                    setAdminVideoFile(
                      file
                    );

                    setUploadProgress(
                      0
                    );

                    setUploadError(
                      ""
                    );

                    setUploadSuccess(
                      ""
                    );
                  }}
                />
              </div>

              {adminVideoFile && (
                <div className="admin-file-info">
                  <strong>
                    📄{" "}
                    {
                      adminVideoFile.name
                    }
                  </strong>

                  <span>
                    {formatFileSize(
                      adminVideoFile.size
                    )}
                  </span>
                </div>
              )}

              {(uploading ||
                uploadProgress >
                  0) && (
                <div className="admin-progress">
                  <div className="admin-progress-top">
                    <span>
                      {uploading
                        ? "⬆️ Uploading to Bunny..."
                        : "Upload"}
                    </span>

                    <strong>
                      {uploadProgress.toFixed(
                        1
                      )}
                      %
                    </strong>
                  </div>

                  <div className="admin-progress-track">
                    <div
                      className="admin-progress-bar"
                      style={{
                        width: `${Math.min(
                          100,
                          uploadProgress
                        )}%`,
                      }}
                    />
                  </div>

                  {uploading && (
                    <small>
                      Kada ka rufe
                      wannan page har
                      upload ya gama.
                    </small>
                  )}
                </div>
              )}

              {uploadError && (
                <div className="auth-error">
                  ❌{" "}
                  {uploadError}
                </div>
              )}

              {uploadSuccess && (
                <div className="admin-upload-success">
                  {uploadSuccess}
                </div>
              )}

              <div className="details-actions">
                {!bunnyStatus
                  ?.connected ? (
                  <button
                    type="button"
                    className="buy-now-button"
                    disabled={
                      uploading ||
                      !adminFilmId ||
                      !adminVideoFile
                    }
                    onClick={
                      uploadFilmToBunny
                    }
                  >
                    {uploading
                      ? `⬆️ Uploading ${uploadProgress.toFixed(
                          1
                        )}%`
                      : "⬆️ Upload to Bunny"}
                  </button>
                ) : (
                  <button
                    type="button"
                    className="buy-now-button"
                    disabled={
                      uploading ||
                      !adminFilmId ||
                      !adminVideoFile
                    }
                    onClick={() => {
                      const confirmed =
                        window.confirm(
                          `Kana tabbatar kana son maye gurbin video na "${selectedAdminFilm?.title}"?\n\nTsohon video zai maye gurbinsa da sabon file ɗin da ka zaɓa.`
                        );

                      if (
                        confirmed
                      ) {
                        replaceFilmOnBunny();
                      }
                    }}
                  >
                    {uploading
                      ? `♻️ Replacing ${uploadProgress.toFixed(
                          1
                        )}%`
                      : "♻️ Replace Video"}
                  </button>
                )}

                <button
                  type="button"
                  className="secondary-button"
                  disabled={
                    uploading
                  }
                  onClick={
                    openProfile
                  }
                >
                  ← Back
                </button>
              </div>

              <div
                style={{
                  marginTop: "34px",
                  paddingTop: "28px",
                  borderTop:
                    "1px solid var(--border)",
                }}
              >
                <p className="small-title">
                  MOVIE TRAILER
                </p>

                <h2
                  style={{
                    fontSize: "24px",
                    marginBottom: "8px",
                  }}
                >
                  🎞️ Trailer Manager
                </h2>

                <p className="details-description">
                  Upload ɗin trailer daban yake da full movie. Bayan ya gama,
                  trailer zai bayyana kai tsaye a sashen Tallan Fina-finai.
                </p>

                {selectedAdminFilm && (
                  <div className="admin-selected-film">
                    <div style={{ width: "100%" }}>
                      <small>TRAILER STATUS</small>

                      {trailerStatusLoading && (
                        <p>
                          🔄 Ana duba trailer status...
                        </p>
                      )}

                      {!trailerStatusLoading &&
                        trailerStatus && (
                          <>
                            <p>
                              Trailer: {" "}
                              {trailerStatus.connected
                                ? "✅ Connected"
                                : "⏳ No Trailer"}
                            </p>

                            {trailerStatus.connected && (
                              <>
                                <p>
                                  Status: {" "}
                                  <strong>
                                    {trailerStatus.ready
                                      ? "✅ Ready"
                                      : trailerStatus.failed
                                        ? "❌ Failed"
                                        : trailerStatus.label ||
                                          "Unknown"}
                                  </strong>
                                </p>

                                <p>
                                  Visible on App: {" "}
                                  {trailerStatus.enabled
                                    ? "✅ Enabled"
                                    : "🚫 Disabled"}
                                </p>

                                <p>
                                  Processing: {" "}
                                  {Number(
                                    trailerStatus.progress || 0
                                  ).toFixed(0)}%
                                </p>

                                {trailerStatus.resolutions
                                  ?.length > 0 && (
                                  <p>
                                    Resolutions: {" "}
                                    {trailerStatus.resolutions.join(
                                      ", "
                                    )}
                                  </p>
                                )}
                              </>
                            )}
                          </>
                        )}

                      {trailerStatusError && (
                        <p className="admin-status-error">
                          ❌ {trailerStatusError}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {selectedAdminFilm && (
                  <div className="details-actions">
                    <button
                      type="button"
                      className="secondary-button"
                      disabled={
                        trailerStatusLoading ||
                        trailerUploading
                      }
                      onClick={() =>
                        loadTrailerStatus(
                          selectedAdminFilm.id
                        )
                      }
                    >
                      {trailerStatusLoading
                        ? "🔄 Checking..."
                        : "🔄 Refresh Trailer Status"}
                    </button>

                    {trailerStatus?.connected && (
                      <button
                        type="button"
                        className="secondary-button"
                        disabled={trailerUploading}
                        onClick={toggleTrailerEnabled}
                      >
                        {trailerStatus.enabled
                          ? "🚫 Disable Trailer"
                          : "✅ Enable Trailer"}
                      </button>
                    )}
                  </div>
                )}

                <div className="admin-upload-field">
                  <label htmlFor="admin-trailer-video">
                    🎞️ Select Trailer Video
                  </label>

                  <input
                    id="admin-trailer-video"
                    type="file"
                    accept="video/*,.mp4,.mkv,.mov,.avi"
                    disabled={
                      trailerUploading ||
                      !adminFilmId
                    }
                    onChange={(event) => {
                      const file =
                        event.target.files?.[0] ||
                        null;

                      setTrailerVideoFile(file);
                      setTrailerUploadProgress(0);
                      setTrailerUploadError("");
                      setTrailerUploadSuccess("");
                    }}
                  />
                </div>

                {trailerVideoFile && (
                  <div className="admin-file-info">
                    <strong>
                      🎞️ {trailerVideoFile.name}
                    </strong>

                    <span>
                      {formatFileSize(
                        trailerVideoFile.size
                      )}
                    </span>
                  </div>
                )}

                {(trailerUploading ||
                  trailerUploadProgress > 0) && (
                  <div className="admin-progress">
                    <div className="admin-progress-top">
                      <span>
                        {trailerUploading
                          ? "🎞️ Uploading Trailer..."
                          : "Trailer Upload"}
                      </span>

                      <strong>
                        {trailerUploadProgress.toFixed(
                          1
                        )}%
                      </strong>
                    </div>

                    <div className="admin-progress-track">
                      <div
                        className="admin-progress-bar"
                        style={{
                          width: `${Math.min(
                            100,
                            trailerUploadProgress
                          )}%`,
                        }}
                      />
                    </div>

                    {trailerUploading && (
                      <small>
                        Kada ka rufe wannan page har trailer upload ya gama.
                      </small>
                    )}
                  </div>
                )}

                {trailerUploadError && (
                  <div className="auth-error">
                    ❌ {trailerUploadError}
                  </div>
                )}

                {trailerUploadSuccess && (
                  <div className="admin-upload-success">
                    {trailerUploadSuccess}
                  </div>
                )}

                <div className="details-actions">
                  <button
                    type="button"
                    className="buy-now-button"
                    disabled={
                      trailerUploading ||
                      uploading ||
                      !adminFilmId ||
                      !trailerVideoFile
                    }
                    onClick={() => {
                      if (
                        selectedAdminFilm
                          ?.trailerBunnyVideoId
                      ) {
                        const confirmed =
                          window.confirm(
                            `Kana tabbatar kana son maye gurbin trailer na "${selectedAdminFilm.title}"?`
                          );

                        if (!confirmed) {
                          return;
                        }
                      }

                      uploadTrailerToBunny();
                    }}
                  >
                    {trailerUploading
                      ? `🎞️ Uploading ${trailerUploadProgress.toFixed(
                          1
                        )}%`
                      : selectedAdminFilm
                            ?.trailerBunnyVideoId
                        ? "♻️ Replace Trailer"
                        : "🎞️ Upload Trailer"}
                  </button>
                </div>
              </div>

              <div className="movie-security-note">
                🔒 Full movie da trailer duka za su tafi kai tsaye daga browser
                zuwa Bunny Stream. Bunny API Key ba zai shiga frontend ba.
              </div>
            </div>
          </div>
        </main>

        <BottomNav
          page={page}
          goHome={goHome}
          goSearch={goSearch}
          loadMyMovies={
            openMyMovies
          }
          openProfile={
            openProfile
          }
        />
      </div>
    );
  }

  // ===================================================
  // PREMIUM PAGE
  // ===================================================

  if (page === "premium") {
    return (
      <div className="app">
        {header}

        <main className="movie-details">
          <button
            type="button"
            className="back-button"
            onClick={goBack}
          >
            ← Back
          </button>

          <div className="movie-details-card">
            <div
              className="details-content"
              style={{
                gridColumn: "1 / -1",
              }}
            >
              <p className="small-title">
                NIGFILM PREMIUM
              </p>

              <h2>
                👑 Premium Membership
              </h2>

              <p className="details-description">
                {language === "HAUSA"
                  ? "Zaɓi tsarin Premium da ya dace da kai. Bayan Paystack ya tabbatar da payment, Premium zai kunna a account ɗinka."
                  : "Choose the Premium plan that works for you. Your membership activates after Paystack confirms payment."}
              </p>

              {hasPremium && (
                <div className="movie-security-note">
                  👑 Premium ɗinka yana aiki yanzu.
                  {premiumStatus?.subscription?.plan
                    ? ` Plan: ${premiumStatus.subscription.plan}.`
                    : ""}
                  {premiumStatus?.subscription?.expiresAt
                    ? ` Expires: ${new Date(
                        premiumStatus.subscription.expiresAt
                      ).toLocaleDateString()}.`
                    : ""}
                </div>
              )}

              {premiumSubscribeError && (
                <div className="auth-error">
                  {premiumSubscribeError}
                </div>
              )}

              {premiumPlansLoading ? (
                <div className="status">
                  <div className="loader" />
                  <p>Loading Premium plans…</p>
                </div>
              ) : (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "repeat(auto-fit, minmax(220px, 1fr))",
                    gap: "16px",
                    marginTop: "20px",
                  }}
                >
                  {premiumPlans.map(
                    (plan) => (
                      <article
                        key={plan.id}
                        className="preference-card"
                        style={{
                          padding: "20px",
                          display: "flex",
                          flexDirection: "column",
                          gap: "12px",
                          minHeight: "230px",
                        }}
                      >
                        <span
                          style={{
                            fontSize: "28px",
                          }}
                        >
                          👑
                        </span>

                        <h3
                          style={{
                            margin: 0,
                          }}
                        >
                          {plan.name || plan.id}
                        </h3>

                        <strong
                          style={{
                            fontSize: "28px",
                          }}
                        >
                          ₦
                          {Number(
                            plan.amount || 0
                          ).toLocaleString()}
                        </strong>

                        <span>
                          {Number(
                            plan.durationDays || 0
                          )}{" "}
                          days
                        </span>

                        <button
                          type="button"
                          className="buy-now-button"
                          style={{
                            marginTop: "auto",
                          }}
                          disabled={
                            Boolean(
                              premiumSubscribeLoading
                            )
                          }
                          onClick={() =>
                            subscribePremium(
                              plan.id
                            )
                          }
                        >
                          {premiumSubscribeLoading ===
                          plan.id
                            ? "Opening Paystack..."
                            : hasPremium
                              ? "👑 Extend Premium"
                              : "👑 Go Premium"}
                        </button>
                      </article>
                    )
                  )}
                </div>
              )}

              {!premiumPlansLoading &&
                premiumPlans.length === 0 &&
                !premiumSubscribeError && (
                  <div className="status">
                    <p>
                      Babu Premium plan da aka samu.
                    </p>
                  </div>
                )}
            </div>
          </div>
        </main>

        <BottomNav
          page={page}
          goHome={goHome}
          goSearch={goSearch}
          loadMyMovies={openMyMovies}
          openProfile={openProfile}
        />
      </div>
    );
  }

  // ===================================================
  // PROFILE PAGE
  // ===================================================

  if (
    page === "profile"
  ) {
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

                {user?.role ===
                  "ADMIN" && (
                  <span>
                    🛡️ Admin
                  </span>
                )}

                {premiumLoading ? (
                  <span>
                    👑 Checking Premium...
                  </span>
                ) : hasPremium ? (
                  <span>
                    👑 Premium Active
                  </span>
                ) : (
                  <span>
                    🎬 Standard Account
                  </span>
                )}
              </div>

              <p className="details-description">
                Duk fina-finan da
                ka saya suna cikin
                My Movies ɗinka.
              </p>

              {premiumError && (
                <div className="auth-error">
                  {premiumError}
                </div>
              )}

              {hasPremium &&
                premiumStatus?.subscription && (
                  <div className="movie-security-note">
                    👑 Premium ɗinka yana aiki.
                    {premiumStatus.subscription.plan
                      ? ` Plan: ${premiumStatus.subscription.plan}.`
                      : ""}
                    {premiumStatus.subscription.expiresAt
                      ? ` Expires: ${new Date(
                          premiumStatus.subscription.expiresAt
                        ).toLocaleDateString()}.`
                      : ""}
                  </div>
                )}

              <div className="preference-panel">
                <h3>⚙️ {t("accountSettings")}</h3>

                <div className="preference-grid">
                  <div className="preference-card">
                    <span>{t("language")}</span>
                    <div className="segmented-control">
                      <button
                        type="button"
                        className={language === "HAUSA" ? "active" : ""}
                        onClick={() => setLanguage("HAUSA")}
                      >
                        Hausa
                      </button>
                      <button
                        type="button"
                        className={language === "ENGLISH" ? "active" : ""}
                        onClick={() => setLanguage("ENGLISH")}
                      >
                        English
                      </button>
                    </div>
                  </div>

                  <div className="preference-card">
                    <span>{t("theme")}</span>
                    <div className="segmented-control">
                      <button
                        type="button"
                        className={theme === "BLACK_GOLD" ? "active" : ""}
                        onClick={() => setTheme("BLACK_GOLD")}
                      >
                        Black & Gold
                      </button>
                      <button
                        type="button"
                        className={theme === "WHITE_GOLD" ? "active" : ""}
                        onClick={() => setTheme("WHITE_GOLD")}
                      >
                        White & Gold
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="details-actions">
                <button
                  type="button"
                  className="buy-now-button"
                  onClick={openPremium}
                >
                  {hasPremium
                    ? "👑 Premium Plans"
                    : "👑 Go Premium"}
                </button>

                <button
                  type="button"
                  className="buy-now-button"
                  onClick={
                    openMyMovies
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

                {user?.role ===
                  "ADMIN" && (
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={
                      openAdminUpload
                    }
                  >
                    ⚙️ Admin Upload
                  </button>
                )}

                {user?.role ===
                  "ADMIN" && (
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={
                      openAdminManageFilms
                    }
                  >
                    🎬 Manage Films
                  </button>
                )}

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
            openMyMovies
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
          <span>
            🔍
          </span>

          <input
            type="text"
            placeholder={t("search")}
            value={search}
            onChange={(
              event
            ) =>
              setSearch(
                event.target
                  .value
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
            {language === "HAUSA" ? (
              <>Kalli fina-finan<br />da kake so.</>
            ) : (
              <>Watch the movies<br />you love.</>
            )}
          </h2>

          <p>
            {t("premiumCinema")}
          </p>

          <button
            type="button"
            onClick={() => {
              document
                .getElementById(
                  "movies"
                )
                ?.scrollIntoView(
                  {
                    behavior:
                      "smooth",
                  }
                );
            }}
          >
            🎬 {t("browseMovies")}
          </button>
        </div>
      </section>

      <section className="section">
        <div className="section-heading">
          <h2>
            {t("categories")}
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
              {t("discover")}
            </p>

            <h2>
              {activeCategory ===
              "All"
                ? t("latestMovies")
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
              Loading movies…
        
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
                Try Again.
              </button>
            </div>
          )}

        {!filmsLoading &&
          !filmsError &&
          filteredFilms.length ===
            0 && (
            <div className="status">
              <p>
                🎬 Babu film a
                wannan category.
              </p>
            </div>
          )}

        {!filmsLoading &&
          !filmsError &&
          filteredFilms.length > 0 &&
          search.trim() && (
            <MovieRow
              films={filteredFilms}
              posterSrc={posterSrc}
              openFilm={openFilm}
              handlePosterError={handlePosterError}
              label={
                activeCategory === "All"
                  ? t("latestMovies")
                  : activeCategory
              }
            />
          )}

        {!filmsLoading &&
          !filmsError &&
          filteredFilms.length > 0 &&
          !search.trim() &&
          activeCategory !== "All" && (
            <MovieRow
              title={activeCategory}
              films={filteredFilms}
              posterSrc={posterSrc}
              openFilm={openFilm}
              handlePosterError={handlePosterError}
              autoSlide
            />
          )}

        {!filmsLoading &&
          !filmsError &&
          !search.trim() &&
          activeCategory === "All" && (
            <div className="streaming-rows">
              {continueWatchingFilms.length > 0 && (
                <ContinueWatchingRow
                  title={
                    language === "HAUSA"
                      ? "Ci gaba da Kallo"
                      : "Continue Watching"
                  }
                  films={
                    continueWatchingFilms.slice(
                      0,
                      10
                    )
                  }
                  watchProgress={
                    watchProgress
                  }
                  posterSrc={posterSrc}
                  openFilm={openFilm}
                  handlePosterError={
                    handlePosterError
                  }
                  onRemoveOne={
                    removeFromContinueWatching
                  }
                  onClearAll={
                    clearContinueWatching
                  }
                  language={language}
                />
              )}

              {films.some((film) => film.featured) && (
                <MovieRow
                  title={t("featured")}
                  films={films.filter((film) => film.featured)}
                  posterSrc={posterSrc}
                  openFilm={openFilm}
                  handlePosterError={handlePosterError}
                  autoSlide
                />
              )}

              {films.some((film) => trailerPlayerUrl(film)) && (
                <TrailerRow
                  title={t("trailers")}
                  films={films.filter((film) => trailerPlayerUrl(film))}
                  posterSrc={posterSrc}
                  openFilm={openFilm}
                  handlePosterError={handlePosterError}
                  trailerPlayerUrl={trailerPlayerUrl}
                  trailerLabel={t("trailer")}
                />
              )}

              <MovieRow
                title={t("latestMovies")}
                films={films}
                posterSrc={posterSrc}
                openFilm={openFilm}
                handlePosterError={handlePosterError}
                autoSlide
                limit={8}
                onSeeAll={() =>
                  openFullCategory("All")
                }
                seeAllLabel={
                  language === "HAUSA"
                    ? "Duba Duk"
                    : "See All"
                }
              />

              <MovieRow
                title={t("hausaMovies")}
                films={films.filter((film) =>
                  String(film.category || "").toLowerCase().includes("hausa")
                )}
                posterSrc={posterSrc}
                openFilm={openFilm}
                handlePosterError={handlePosterError}
                autoSlide
                limit={8}
                onSeeAll={() =>
                  openFullCategory("Hausa")
                }
                seeAllLabel={
                  language === "HAUSA"
                    ? "Duba Duk"
                    : "See All"
                }
              />

              <MovieRow
                title={t("indiaMovies")}
                films={films.filter((film) => {
                  const category = String(film.category || "").toLowerCase();
                  return category.includes("india") || category.includes("indian");
                })}
                posterSrc={posterSrc}
                openFilm={openFilm}
                handlePosterError={handlePosterError}
                autoSlide
                limit={8}
                onSeeAll={() =>
                  openFullCategory("India Fassara")
                }
                seeAllLabel={
                  language === "HAUSA"
                    ? "Duba Duk"
                    : "See All"
                }
              />

              <MovieRow
                title={t("americanMovies")}
                films={films.filter((film) => {
                  const category = String(film.category || "").toLowerCase();
                  return category.includes("american") || category.includes("america");
                })}
                posterSrc={posterSrc}
                openFilm={openFilm}
                handlePosterError={handlePosterError}
                autoSlide
                limit={8}
                onSeeAll={() =>
                  openFullCategory("American")
                }
                seeAllLabel={
                  language === "HAUSA"
                    ? "Duba Duk"
                    : "See All"
                }
              />

              <MovieRow
                title={t("series")}
                films={films.filter((film) =>
                  String(film.category || "").toLowerCase().includes("series")
                )}
                posterSrc={posterSrc}
                openFilm={openFilm}
                handlePosterError={handlePosterError}
                autoSlide
                limit={8}
                onSeeAll={() =>
                  openFullCategory("Series")
                }
                seeAllLabel={
                  language === "HAUSA"
                    ? "Duba Duk"
                    : "See All"
                }
              />
            </div>
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
function DashboardMovieGrid({
  title,
  films,
  posterSrc,
  openFilm,
  handlePosterError,
  limit = 8,
  onSeeAll,
  seeAllLabel = "See All",
}) {
  if (
    !Array.isArray(films) ||
    films.length === 0
  ) {
    return null;
  }

  const displayedFilms =
    films.slice(0, limit);

  return (
    <section className="dashboard-grid-section">
      <div className="row-heading">
        <h3>{title}</h3>

        <div className="dashboard-grid-heading-right">
          <span>{films.length}</span>

          {films.length > limit &&
            typeof onSeeAll ===
              "function" && (
              <button
                type="button"
                className="dashboard-see-all"
                onClick={onSeeAll}
              >
                {seeAllLabel} →
              </button>
            )}
        </div>
      </div>

      <div className="dashboard-movie-grid">
        {displayedFilms.map(
          (film) => (
            <article
              className="dashboard-movie-card"
              key={film.id}
            >
              <button
                type="button"
                className="dashboard-poster-button"
                onClick={() =>
                  openFilm(film)
                }
              >
                <img
                  src={posterSrc(film)}
                  alt={film.title}
                  loading="lazy"
                  decoding="async"
                  onError={
                    handlePosterError
                  }
                />

                <span className="row-price">
                  🔒 ACCESS
                </span>

                <span className="row-play">
                  ▶
                </span>
              </button>

              <div className="dashboard-card-info">
                <strong>
                  {film.title}
                </strong>

                <span>
                  {film.category ||
                    "Movie"}
                </span>
              </div>
            </article>
          )
        )}
      </div>
    </section>
  );
}
// =====================================================
// HORIZONTAL MOVIE ROW
// =====================================================

function MovieRow({
  title,
  label,
  films,
  posterSrc,
  openFilm,
  handlePosterError,
  autoSlide = false,
  limit = null,
  onSeeAll = null,
  seeAllLabel = "See All",
}) {
  const rowRef = useRef(null);
  const pauseUntilRef = useRef(0);

  function pauseAutoSlide(
    milliseconds = 8000
  ) {
    pauseUntilRef.current =
      Date.now() + milliseconds;
  }

  useEffect(() => {
    if (
      !autoSlide ||
      !Array.isArray(films) ||
      films.length < 2
    ) {
      return;
    }

    const timer = setInterval(() => {
      const row = rowRef.current;

      if (
        !row ||
        Date.now() <
          pauseUntilRef.current
      ) {
        return;
      }

      const card =
        row.querySelector(
          ".row-card"
        );

      if (!card) {
        return;
      }

      const style =
        window.getComputedStyle(row);

      const gap =
        Number.parseFloat(
          style.columnGap ||
            style.gap ||
            "0"
        ) || 0;

      const step =
        card.getBoundingClientRect()
          .width + gap;

      const nearEnd =
        row.scrollLeft +
          row.clientWidth >=
        row.scrollWidth -
          step * 0.75;

      row.scrollTo({
        left: nearEnd
          ? 0
          : row.scrollLeft +
            step,
        behavior: "smooth",
      });
    }, 6000);

    return () =>
      clearInterval(timer);
  }, [autoSlide, films]);

  if (
    !Array.isArray(films) ||
    films.length === 0
  ) {
    return null;
  }

  const displayedFilms =
    Number.isInteger(limit) &&
    limit > 0
      ? films.slice(0, limit)
      : films;

  const showSeeAll =
    typeof onSeeAll === "function" &&
    Number.isInteger(limit) &&
    limit > 0 &&
    films.length > limit;

  return (
    <section className="movie-row-section">
      {(title || label) && (
        <div className="row-heading">
          <h3>{title || label}</h3>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
            }}
          >
            <span>{films.length}</span>

            {showSeeAll && (
              <button
                type="button"
                onClick={onSeeAll}
                style={{
                  padding: 0,
                  border: 0,
                  background: "transparent",
                  color: "var(--gold)",
                  fontSize: "11px",
                  fontWeight: 900,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                {seeAllLabel} →
              </button>
            )}
          </div>
        </div>
      )}

      <div
        ref={rowRef}
        className="movie-row"
        style={{
          scrollSnapType: "x mandatory",
          scrollBehavior: "smooth",
          overscrollBehaviorX:
            "contain",
        }}
        onPointerDown={() =>
          pauseAutoSlide(10000)
        }
        onTouchStart={() =>
          pauseAutoSlide(10000)
        }
        onWheel={() =>
          pauseAutoSlide(8000)
        }
        onMouseEnter={() =>
          pauseAutoSlide(5000)
        }
      >
        {displayedFilms.map((film) => (
          <article
            className="row-card"
            key={film.id}
            style={{
              scrollSnapAlign:
                "start",
              flex:
                "0 0 clamp(132px, 40vw, 180px)",
              width:
                "clamp(132px, 40vw, 180px)",
              minWidth:
                "clamp(132px, 40vw, 180px)",
              maxWidth: "180px",
            }}
          >
            <button
              type="button"
              className="row-poster-button"
              onClick={() =>
                openFilm(film)
              }
            >
              <img
                src={posterSrc(film)}
                alt={film.title}
                loading="lazy"
                decoding="async"
                onError={
                  handlePosterError
                }
              />

              <span className="row-price">
                🔒 ACCESS
              </span>

              <span className="row-play">
                ▶
              </span>
            </button>

            <div className="row-card-info">
              <strong>
                {film.title}
              </strong>
              <span>
                {film.category ||
                  "Movie"}
              </span>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

// =====================================================
// VERTICAL MOVIE LIST
// =====================================================

function VerticalMovieList({
  title,
  films,
  posterSrc,
  openFilm,
  handlePosterError,
  onSeeAll = null,
  seeAllLabel = "See All",
  limit = 8,
}) {
  if (
    !Array.isArray(films) ||
    films.length === 0
  ) {
    return null;
  }

  const displayedFilms =
    Number.isInteger(limit) &&
    limit > 0
      ? films.slice(0, limit)
      : films;

  const showSeeAll =
    typeof onSeeAll === "function" &&
    Number.isInteger(limit) &&
    limit > 0 &&
    films.length > limit;

  return (
    <section className="movie-row-section">
      <div className="row-heading">
        <h3>{title}</h3>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
          }}
        >
          <span>{films.length}</span>

          {showSeeAll && (
              <button
                type="button"
                onClick={onSeeAll}
                style={{
                  padding: 0,
                  border: 0,
                  background: "transparent",
                  color: "var(--gold)",
                  fontSize: "11px",
                  fontWeight: 900,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                {seeAllLabel} →
              </button>
            )}
        </div>
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "12px",
        }}
      >
        {displayedFilms.map(
          (film) => (
            <article
              key={film.id}
              role="button"
              tabIndex={0}
              onClick={() =>
                openFilm(film)
              }
              onKeyDown={(event) => {
                if (
                  event.key ===
                    "Enter" ||
                  event.key === " "
                ) {
                  openFilm(film);
                }
              }}
              style={{
                display: "flex",
                gap: "14px",
                alignItems: "center",
                padding: "10px",
                borderRadius: "16px",
                cursor: "pointer",
                background:
                  "var(--card-bg, rgba(255,255,255,0.04))",
                border:
                  "1px solid var(--border-color, rgba(212,175,55,0.18))",
              }}
            >
              <img
                src={posterSrc(film)}
                alt={film.title}
                loading="lazy"
                decoding="async"
                onError={
                  handlePosterError
                }
                style={{
                  width: "82px",
                  height: "118px",
                  objectFit: "cover",
                  borderRadius: "12px",
                  flexShrink: 0,
                }}
              />

              <div
                style={{
                  minWidth: 0,
                  flex: 1,
                }}
              >
                <strong
                  style={{
                    display: "block",
                    fontSize: "16px",
                    marginBottom: "7px",
                  }}
                >
                  {film.title}
                </strong>

                <span
                  style={{
                    display: "block",
                    opacity: 0.75,
                    marginBottom: "8px",
                  }}
                >
                  {film.category ||
                    "Movie"}
                </span>

                <strong>
                  🔒 ACCESS
                </strong>

                <div
                  style={{
                    marginTop: "10px",
                    fontSize: "13px",
                    opacity: 0.8,
                  }}
                >
                  ▶ Duba Film
                </div>
              </div>
            </article>
          )
        )}
      </div>
    </section>
  );
}

function TrailerRow({
  title,
  films,
  posterSrc,
  openFilm,
  handlePosterError,
  trailerPlayerUrl,
  trailerLabel,
}) {
  const [previewId, setPreviewId] = useState(null);

  const hoverTimerRef = useRef(null);
  const sectionRef = useRef(null);
  const rowRef = useRef(null);
  const cardRefs = useRef(new Map());
  const pauseUntilRef = useRef(0);

  function pauseTrailerAuto(
    milliseconds = 8000
  ) {
    pauseUntilRef.current =
      Date.now() + milliseconds;
  }

  // ===================================================
  // LIGHT BUNNY PRECONNECT
  // ===================================================

  useEffect(() => {
    const section = sectionRef.current;

    if (!section) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];

        if (!entry?.isIntersecting) return;

        const origins = [
          "https://player.mediadelivery.net",
          "https://video.bunnycdn.com",
        ];

        origins.forEach((origin) => {
          const alreadyExists =
            document.head.querySelector(
              `link[data-nigfilm-preconnect="${origin}"]`
            );

          if (alreadyExists) return;

          const link = document.createElement("link");

          link.rel = "preconnect";
          link.href = origin;
          link.crossOrigin = "anonymous";

          link.setAttribute(
            "data-nigfilm-preconnect",
            origin
          );

          document.head.appendChild(link);
        });

        observer.disconnect();
      },
      {
        root: null,
        rootMargin: "250px 0px",
        threshold: 0.01,
      }
    );

    observer.observe(section);

    return () => {
      observer.disconnect();
    };
  }, []);

  // ===================================================
  // STOP PREVIEW IF CARD LEAVES SCREEN
  // ===================================================

  useEffect(() => {
    if (!previewId) {
      return;
    }

    const card =
      cardRefs.current.get(
        String(previewId)
      );

    if (!card) {
      return;
    }

    const observer =
      new IntersectionObserver(
        (entries) => {
          const entry = entries[0];

          if (
            !entry?.isIntersecting ||
            entry.intersectionRatio < 0.35
          ) {
            clearTimeout(
              hoverTimerRef.current
            );

            setPreviewId(null);
          }
        },
        {
          threshold: [
            0,
            0.35,
            0.5,
            1,
          ],
        }
      );

    observer.observe(card);

    return () => {
      observer.disconnect();
    };
  }, [previewId]);

  // ===================================================
  // START PREVIEW
  // ===================================================
function startPreview(film) {
  const trailerUrl =
    trailerPlayerUrl(film);

  if (!trailerUrl) {
    return;
  }

  clearTimeout(
    hoverTimerRef.current
  );

  // Stop any currently playing preview first
  setPreviewId(null);

  hoverTimerRef.current =
    setTimeout(() => {
      setPreviewId(
        film.id
      );
    }, 650);
}
  // ===================================================
  // STOP PREVIEW
  // ===================================================

  function stopPreview() {
    clearTimeout(
      hoverTimerRef.current
    );

    setPreviewId(null);
  }

  useEffect(() => {
    return () => {
      clearTimeout(
        hoverTimerRef.current
      );
    };
  }, []);

  useEffect(() => {
    if (
      !Array.isArray(films) ||
      films.length < 2
    ) {
      return;
    }

    const timer = setInterval(() => {
      const row = rowRef.current;

      if (
        !row ||
        previewId ||
        Date.now() <
          pauseUntilRef.current
      ) {
        return;
      }

      const card =
        row.querySelector(
          ".trailer-card"
        );

      if (!card) {
        return;
      }

      const style =
        window.getComputedStyle(row);

      const gap =
        Number.parseFloat(
          style.columnGap ||
            style.gap ||
            "0"
        ) || 0;

      const step =
        card.getBoundingClientRect()
          .width + gap;

      const nearEnd =
        row.scrollLeft +
          row.clientWidth >=
        row.scrollWidth -
          step * 0.75;

      row.scrollTo({
        left: nearEnd
          ? 0
          : row.scrollLeft +
            step,
        behavior: "smooth",
      });
    }, 6500);

    return () =>
      clearInterval(timer);
  }, [films, previewId]);

  if (
    !Array.isArray(films) ||
    films.length === 0
  ) {
    return null;
  }

  return (
    <section
      ref={sectionRef}
      className="movie-row-section trailer-row-section"
    >
      <div className="row-heading">
        <h3>
          🎞️ {title}
        </h3>

        <span>
          {films.length}
        </span>
      </div>

      <div
        ref={rowRef}
        className="trailer-row"
        style={{
          scrollSnapType: "x mandatory",
          scrollBehavior: "smooth",
          overscrollBehaviorX:
            "contain",
        }}
        onPointerDown={() =>
          pauseTrailerAuto(10000)
        }
        onTouchStart={() =>
          pauseTrailerAuto(10000)
        }
        onWheel={() =>
          pauseTrailerAuto(8000)
        }
      >
        {films.map((film) => {
          const trailerUrl =
            trailerPlayerUrl(film);

          const previewing =
            Number(previewId) ===
            Number(film.id);

          return (
            <article
              ref={(node) => {
                const key =
                  String(film.id);

                if (node) {
                  cardRefs.current.set(
                    key,
                    node
                  );
                } else {
                  cardRefs.current.delete(
                    key
                  );
                }
              }}

              className={`trailer-card ${
                previewing
                  ? "is-previewing"
                  : ""
              }`}

              key={film.id}

              style={{
                scrollSnapAlign:
                  "start",
              }}

              onMouseEnter={() => {
                pauseTrailerAuto(9000);
                startPreview(film);
              }}

              onMouseLeave={
                stopPreview
              }
            >
              <div
                className="trailer-thumb"

                onClick={() => {
                  if (!trailerUrl) {
                    openFilm(film);
                    return;
                  }

                  clearTimeout(
                    hoverTimerRef.current
                  );

                  setPreviewId(
                    (current) =>
                      Number(current) ===
                      Number(film.id)
                        ? null
                        : film.id
                  );
                }}
              >
                {!previewing ? (
                  <>
                    <img
                      src={posterSrc(film)}
                      alt={film.title}
                      loading="lazy"
                      decoding="async"
                      onError={
                        handlePosterError
                      }
                    />

                    <div className="trailer-preview-overlay">
                      <span className="trailer-preview-play">
                        ▶
                      </span>

                      <span className="trailer-preview-text">
                        {trailerLabel}
                      </span>
                    </div>
                  </>
                ) : (
                  <iframe
                    className="trailer-auto-preview"

                    src={`${trailerUrl}${
                      trailerUrl.includes("?")
                        ? "&"
                        : "?"
                    }autoplay=true&muted=true`}

                    title={`${film.title} trailer preview`}

                    loading="eager"

                    allow="autoplay; encrypted-media; picture-in-picture"

                    allowFullScreen
                  />
                )}
              </div>

              <div className="trailer-card-bottom">
                <strong>
                  {film.title}
                </strong>

                <button
                  type="button"

                  onClick={(event) => {
                    event.stopPropagation();

                    clearTimeout(
                      hoverTimerRef.current
                    );

                    setPreviewId(null);

                    openFilm(film);
                  }}
                >
                  Duba Film →
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
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
  handlePosterError,
}) {
  return (
    <div className="movie-grid">
      {films.map(
        (rawFilm) => {
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
                  openFilm(
                    film
                  )
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
                  src={posterSrc(
                    film
                  )}
                  alt={
                    film.title
                  }
                  className="poster"
                  loading="lazy"
                  onError={handlePosterError}
                />

                {!purchased && (
                  <span className="price">
                    🔒 ACCESS
                  </span>
                )}

                <div className="play-button">
                  ▶
                </div>
              </div>

              <div className="movie-info">
                <h3>
                  {
                    film.title
                  }
                </h3>

                <p>
                  {film.category ||
                    "Movie"}
                </p>

                <button
                  type="button"
                  onClick={() =>
                    openFilm(
                      film
                    )
                  }
                >
                  {purchased
                    ? "▶ Watch Movie"
                    : "View Movie"}
                </button>
              </div>
            </article>
          );
        }
      )}
    </div>
  );
}

// =====================================================
// BUNNY FULL MOVIE PLAYER
// Resume + 10s backward/forward
// =====================================================

let bunnyPlayerScriptPromise = null;

function ensureBunnyPlayerJs() {
  if (
    window.playerjs?.Player
  ) {
    return Promise.resolve();
  }

  if (bunnyPlayerScriptPromise) {
    return bunnyPlayerScriptPromise;
  }

  bunnyPlayerScriptPromise =
    new Promise(
      (resolve, reject) => {
        const existing =
          document.getElementById(
            "nigfilm-playerjs-script"
          );

        if (existing) {
          existing.addEventListener(
            "load",
            () => resolve(),
            { once: true }
          );

          existing.addEventListener(
            "error",
            () =>
              reject(
                new Error(
                  "Player.js bai load ba."
                )
              ),
            { once: true }
          );

          if (
            window.playerjs?.Player
          ) {
            resolve();
          }

          return;
        }

        const script =
          document.createElement(
            "script"
          );

        script.id =
          "nigfilm-playerjs-script";

        script.src =
          "https://assets.mediadelivery.net/playerjs/playerjs-latest.min.js";

        script.async = true;

        script.onload = () =>
          resolve();

        script.onerror = () =>
          reject(
            new Error(
              "Player.js bai load ba."
            )
          );

        document.head.appendChild(
          script
        );
      }
    );

  return bunnyPlayerScriptPromise;
}

function parsePlayerTiming(
  raw
) {
  if (!raw) {
    return {};
  }

  if (
    typeof raw === "object"
  ) {
    return raw;
  }

  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function BunnyMoviePlayer({
  src,
  title,
  filmId,
  userId,
  language,
  onProgressChange,
}) {
  const iframeRef =
    useRef(null);

  const playerRef =
    useRef(null);

  const lastSavedSecondRef =
    useRef(-1);

  const resumeAttemptedRef =
    useRef(false);

  const [
    apiReady,
    setApiReady,
  ] = useState(false);

  const [
    playerError,
    setPlayerError,
  ] = useState("");

  const [
    currentSeconds,
    setCurrentSeconds,
  ] = useState(0);

  const [
    durationSeconds,
    setDurationSeconds,
  ] = useState(0);

  const storageKey =
    `nigfilm_watch_progress_${userId}`;

  const uniqueSrc =
    useMemo(() => {
      const separator =
        String(src).includes("?")
          ? "&"
          : "?";

      return (
        `${src}${separator}` +
        `nigfilmPlayer=${encodeURIComponent(
          `${filmId}-${userId || "guest"}`
        )}`
      );
    }, [
      src,
      filmId,
      userId,
    ]);

  function readSavedProgress() {
    if (!userId) {
      return null;
    }

    try {
      const raw =
        localStorage.getItem(
          storageKey
        );

      const all =
        raw
          ? JSON.parse(raw)
          : {};

      return (
        all?.[
          Number(filmId)
        ] || null
      );
    } catch {
      return null;
    }
  }

  useEffect(() => {
    let cancelled = false;

    setApiReady(false);
    setPlayerError("");

    ensureBunnyPlayerJs()
      .then(() => {
        if (!cancelled) {
          setApiReady(true);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setPlayerError(
            error?.message ||
              "An kasa shirya video controls."
          );
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (
      !apiReady ||
      !iframeRef.current ||
      !window.playerjs?.Player
    ) {
      return;
    }

    const player =
      new window.playerjs.Player(
        iframeRef.current
      );

    playerRef.current =
      player;

    let disposed = false;

    const saveProgress = (
      seconds,
      duration
    ) => {
      if (
        !userId ||
        !Number.isFinite(seconds) ||
        seconds < 0
      ) {
        return;
      }

      const safeDuration =
        Number.isFinite(duration)
          ? duration
          : 0;

      const rounded =
        Math.floor(seconds);

      // Save at most once every ~3 seconds.
      if (
        rounded !== 0 &&
        Math.abs(
          rounded -
            lastSavedSecondRef.current
        ) < 3
      ) {
        return;
      }

      lastSavedSecondRef.current =
        rounded;

      if (
        safeDuration > 0 &&
        seconds >=
          safeDuration - 10
      ) {
        onProgressChange?.(
          filmId,
          null
        );

        return;
      }

      onProgressChange?.(
        filmId,
        {
          seconds,
          duration:
            safeDuration,
          updatedAt:
            Date.now(),
        }
      );
    };

    const handleReady = () => {
      if (
        disposed ||
        resumeAttemptedRef.current
      ) {
        return;
      }

      resumeAttemptedRef.current =
        true;

      const saved =
        readSavedProgress();

      const savedSeconds =
        Number(
          saved?.seconds || 0
        );

      if (
        Number.isFinite(
          savedSeconds
        ) &&
        savedSeconds >= 5
      ) {
        try {
          player.setCurrentTime(
            savedSeconds
          );
        } catch {
          // Keep playing from start if resume is unsupported.
        }
      }

      try {
        player.getDuration(
          (duration) => {
            const value =
              Number(duration);

            if (
              Number.isFinite(value)
            ) {
              setDurationSeconds(
                value
              );
            }
          }
        );
      } catch {
        // Duration will also arrive through timeupdate.
      }
    };

    const handleTimeUpdate = (
      raw
    ) => {
      if (disposed) {
        return;
      }

      const timing =
        parsePlayerTiming(raw);

      const seconds =
        Number(
          timing.seconds ?? 0
        );

      const duration =
        Number(
          timing.duration ?? 0
        );

      if (
        Number.isFinite(seconds)
      ) {
        setCurrentSeconds(
          seconds
        );
      }

      if (
        Number.isFinite(duration) &&
        duration > 0
      ) {
        setDurationSeconds(
          duration
        );
      }

      saveProgress(
        seconds,
        duration
      );
    };

    const handleEnded = () => {
      setCurrentSeconds(
        durationSeconds || 0
      );

      onProgressChange?.(
        filmId,
        null
      );
    };

    const handlePlayerError = () => {
      if (!disposed) {
        setPlayerError(
          language === "HAUSA"
            ? "An samu matsala a video player. Ka sake gwadawa."
            : "The video player encountered an error. Please try again."
        );
      }
    };

    player.on(
      "ready",
      handleReady
    );

    player.on(
      "timeupdate",
      handleTimeUpdate
    );

    player.on(
      "ended",
      handleEnded
    );

    player.on(
      "error",
      handlePlayerError
    );

    return () => {
      disposed = true;

      try {
        player.off(
          "ready",
          handleReady
        );

        player.off(
          "timeupdate",
          handleTimeUpdate
        );

        player.off(
          "ended",
          handleEnded
        );

        player.off(
          "error",
          handlePlayerError
        );
      } catch {
        // Ignore cleanup differences between Player.js versions.
      }

      if (
        playerRef.current ===
        player
      ) {
        playerRef.current =
          null;
      }
    };
  }, [
    apiReady,
    uniqueSrc,
    filmId,
    userId,
    language,
    onProgressChange,
  ]);

  function seekBy(
    amount
  ) {
    const player =
      playerRef.current;

    if (!player) {
      return;
    }

    try {
      player.getCurrentTime(
        (value) => {
          const current =
            Number(value || 0);

          const duration =
            Number(
              durationSeconds || 0
            );

          let next =
            current + amount;

          next =
            Math.max(
              0,
              next
            );

          if (duration > 0) {
            next =
              Math.min(
                next,
                Math.max(
                  0,
                  duration - 0.25
                )
              );
          }

          player.setCurrentTime(
            next
          );
        }
      );
    } catch {
      setPlayerError(
        language === "HAUSA"
          ? "Seek bai yi aiki ba tukuna."
          : "Seek is not available right now."
      );
    }
  }

  const progressPercent =
    durationSeconds > 0
      ? Math.max(
          0,
          Math.min(
            100,
            (currentSeconds /
              durationSeconds) *
              100
          )
        )
      : 0;

  return (
    <div className="nigfilm-full-player">
      {!apiReady &&
        !playerError && (
          <div className="movie-security-note">
            ⏳{" "}
            {language === "HAUSA"
              ? "Ana shirya video player..."
              : "Preparing video player..."}
          </div>
        )}

      {apiReady && (
        <>
          <div
            className="bunny-player"
            style={{
              position: "relative",
            }}
          >
            <iframe
              ref={iframeRef}
              src={uniqueSrc}
              title={title}
              loading="lazy"
              allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture"
              allowFullScreen
            />

            <button
              type="button"
              aria-label={
                language === "HAUSA"
                  ? "Mayar da video baya da sakan 10"
                  : "Rewind 10 seconds"
              }
              title={
                language === "HAUSA"
                  ? "Baya 10s"
                  : "Rewind 10s"
              }
              onClick={() =>
                seekBy(-10)
              }
              style={{
                position:
                  "absolute",
                left: "16px",
                top: "50%",
                transform:
                  "translateY(-50%)",
                zIndex: 20,
                width: "52px",
                height: "52px",
                display: "flex",
                flexDirection:
                  "column",
                alignItems:
                  "center",
                justifyContent:
                  "center",
                gap: "0",
                padding: 0,
                border:
                  "1px solid rgba(255,255,255,.50)",
                borderRadius:
                  "50%",
                background:
                  "rgba(0,0,0,.58)",
                color: "#fff",
                boxShadow:
                  "0 6px 18px rgba(0,0,0,.32)",
                backdropFilter:
                  "blur(4px)",
                WebkitBackdropFilter:
                  "blur(4px)",
                cursor: "pointer",
              }}
            >
              <span
                style={{
                  fontSize:
                    "21px",
                  lineHeight: 1,
                }}
              >
                ↶
              </span>
              <small
                style={{
                  marginTop:
                    "-2px",
                  fontSize:
                    "10px",
                  fontWeight: 900,
                  lineHeight: 1,
                }}
              >
                10
              </small>
            </button>

            <button
              type="button"
              aria-label={
                language === "HAUSA"
                  ? "Kai video gaba da sakan 10"
                  : "Forward 10 seconds"
              }
              title={
                language === "HAUSA"
                  ? "Gaba 10s"
                  : "Forward 10s"
              }
              onClick={() =>
                seekBy(10)
              }
              style={{
                position:
                  "absolute",
                right: "16px",
                top: "50%",
                transform:
                  "translateY(-50%)",
                zIndex: 20,
                width: "52px",
                height: "52px",
                display: "flex",
                flexDirection:
                  "column",
                alignItems:
                  "center",
                justifyContent:
                  "center",
                gap: "0",
                padding: 0,
                border:
                  "1px solid rgba(255,255,255,.50)",
                borderRadius:
                  "50%",
                background:
                  "rgba(0,0,0,.58)",
                color: "#fff",
                boxShadow:
                  "0 6px 18px rgba(0,0,0,.32)",
                backdropFilter:
                  "blur(4px)",
                WebkitBackdropFilter:
                  "blur(4px)",
                cursor: "pointer",
              }}
            >
              <span
                style={{
                  fontSize:
                    "21px",
                  lineHeight: 1,
                }}
              >
                ↷
              </span>
              <small
                style={{
                  marginTop:
                    "-2px",
                  fontSize:
                    "10px",
                  fontWeight: 900,
                  lineHeight: 1,
                }}
              >
                10
              </small>
            </button>
          </div>

          <div
            style={{
              height: "5px",
              overflow: "hidden",
              borderRadius:
                "999px",
              background:
                "rgba(255,255,255,.10)",
              marginBottom:
                "8px",
            }}
          >
            <div
              style={{
                width:
                  `${progressPercent}%`,
                height: "100%",
                background:
                  "var(--gold)",
                transition:
                  "width .25s linear",
              }}
            />
          </div>
        </>
      )}

      {playerError && (
        <div className="auth-error">
          {playerError}
        </div>
      )}
    </div>
  );
}

// =====================================================
// CONTINUE WATCHING ROW
// =====================================================

function ContinueWatchingRow({
  title,
  films,
  watchProgress,
  posterSrc,
  openFilm,
  handlePosterError,
  onRemoveOne,
  onClearAll,
  language = "HAUSA",
}) {
  if (
    !Array.isArray(films) ||
    films.length === 0
  ) {
    return null;
  }

  return (
    <section className="movie-row-section">
      <div className="row-heading">
        <h3>
          ▶ {title}
        </h3>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
          }}
        >
          <span>
            {films.length}
          </span>

          <button
            type="button"
            onClick={() =>
              onClearAll?.()
            }
            style={{
              padding: "5px 9px",
              border:
                "1px solid rgba(239,68,68,.35)",
              borderRadius: "8px",
              background:
                "rgba(239,68,68,.08)",
              color: "#ef4444",
              fontSize: "10px",
              fontWeight: 900,
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
            title={
              language === "HAUSA"
                ? "Cire duk daga Ci gaba da Kallo"
                : "Clear all Continue Watching"
            }
          >
            {language === "HAUSA"
              ? "Cire Duka"
              : "Clear All"}
          </button>
        </div>
      </div>

      <div className="movie-row">
        {films.map((film) => {
          const progress =
            watchProgress[
              Number(film.id)
            ] || {};

          const seconds =
            Number(
              progress.seconds || 0
            );

          const duration =
            Number(
              progress.duration || 0
            );

          const percent =
            duration > 0
              ? Math.max(
                  0,
                  Math.min(
                    100,
                    (seconds /
                      duration) *
                      100
                  )
                )
              : 0;

          return (
            <article
              className="row-card"
              key={film.id}
              style={{
                position: "relative",
              }}
            >
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onRemoveOne?.(
                    film.id
                  );
                }}
                aria-label={
                  language === "HAUSA"
                    ? `Cire ${film.title} daga Ci gaba da Kallo`
                    : `Remove ${film.title} from Continue Watching`
                }
                title={
                  language === "HAUSA"
                    ? "Cire daga Ci gaba da Kallo"
                    : "Remove from Continue Watching"
                }
                style={{
                  position: "absolute",
                  top: "7px",
                  right: "7px",
                  zIndex: 8,
                  width: "28px",
                  height: "28px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent:
                    "center",
                  padding: 0,
                  border:
                    "1px solid rgba(255,255,255,.28)",
                  borderRadius: "50%",
                  background:
                    "rgba(0,0,0,.76)",
                  color: "#fff",
                  fontSize: "16px",
                  fontWeight: 900,
                  lineHeight: 1,
                  cursor: "pointer",
                  boxShadow:
                    "0 4px 12px rgba(0,0,0,.28)",
                }}
              >
                ×
              </button>

              <button
                type="button"
                className="row-poster-button"
                onClick={() =>
                  openFilm(film)
                }
                style={{
                  width: "100%",
                  aspectRatio: "2 / 3",
                  borderRadius: "15px",
                  overflow: "hidden",
                }}
              >
                <img
                  src={
                    posterSrc(film)
                  }
                  alt={film.title}
                  loading="lazy"
                  decoding="async"
                  onError={
                    handlePosterError
                  }
                />

                <span className="row-play">
                  ▶
                </span>

                <div
                  style={{
                    position:
                      "absolute",
                    left: 0,
                    right: 0,
                    bottom: 0,
                    height: "5px",
                    background:
                      "rgba(0,0,0,.55)",
                  }}
                >
                  <div
                    style={{
                      width:
                        `${percent}%`,
                      height: "100%",
                      background:
                        "var(--gold)",
                    }}
                  />
                </div>
              </button>

              <div className="row-card-info">
                <strong>
                  {film.title}
                </strong>

                <span>
                  {percent > 0
                    ? `${Math.round(
                        percent
                      )}%`
                    : "Continue"}
                </span>
              </div>
            </article>
          );
        })}
      </div>
    </section>
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
// FORMAT FILE SIZE
// =====================================================

function formatFileSize(
  bytes
) {
  const size =
    Number(bytes || 0);

  if (size <= 0) {
    return "0 MB";
  }

  if (
    size >=
    1024 *
      1024 *
      1024
  ) {
    return `${(
      size /
      (1024 *
        1024 *
        1024)
    ).toFixed(2)} GB`;
  }

  return `${(
    size /
    (1024 * 1024)
  ).toFixed(2)} MB`;
}

// =====================================================
// SAFE JSON
// =====================================================

async function readJson(
  response
) {
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