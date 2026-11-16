import { createHmac, timingSafeEqual } from "node:crypto";

export function publicTrailer(film) {
  return film.trailerEnabled ? film : { ...film, trailerUrl: null, trailerBunnyVideoId: null };
}

function signature(secret, userId, filmId, expires) {
  return createHmac("sha256", secret).update(`hidden-film-media:v1:${userId}:${filmId}:${expires}`).digest("hex");
}

export function makeFilmMediaTicket(secret, userId, filmId, now = Date.now()) {
  if (!secret) return null;
  const expires = now + 5 * 60 * 1000;
  return `${expires}.${signature(secret, userId, filmId, expires)}`;
}

export function validFilmMediaTicket(secret, value, userId, filmId, now = Date.now()) {
  if (!secret || typeof value !== "string" || !/^\d{13}\.[a-f0-9]{64}$/.test(value)) return false;
  const [expires, mac] = value.split(".");
  if (Number(expires) <= now) return false;
  return timingSafeEqual(Buffer.from(mac, "hex"), Buffer.from(signature(secret, userId, filmId, expires), "hex"));
}
