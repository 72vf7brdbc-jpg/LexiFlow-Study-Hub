/** Reads English text aloud with the browser's built-in voice, if available. */
export function speakEnglish(text: string) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return false;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "en-GB";
  u.rate = 0.92;
  const voices = window.speechSynthesis.getVoices();
  const voice = voices.find((v) => v.lang === "en-GB") ?? voices.find((v) => v.lang.startsWith("en"));
  if (voice) u.voice = voice;
  window.speechSynthesis.speak(u);
  return true;
}
