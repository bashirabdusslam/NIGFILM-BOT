import "dotenv/config";

const libraryId =
  process.env.BUNNY_STREAM_LIBRARY_ID;

const apiKey =
  process.env.BUNNY_STREAM_API_KEY;

if (!libraryId) {
  console.log("❌ BUNNY_STREAM_LIBRARY_ID babu");
  process.exit(1);
}

if (!apiKey) {
  console.log("❌ BUNNY_STREAM_API_KEY babu");
  process.exit(1);
}

console.log("✅ Bunny Stream config yana nan");
console.log("Library ID:", libraryId);
console.log(
  "API Key:",
  apiKey.length > 10
    ? "FOUND ✅"
    : "INVALID ❌"
);