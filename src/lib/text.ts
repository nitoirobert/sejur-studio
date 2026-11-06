// Text fără diacritice și fără majuscule: „Brașov" se găsește și cu „brasov".
// Păstrează numărul de caractere, deci pozițiile din textul original rămân valabile.
export const normalize = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").normalize("NFC").toLowerCase();
