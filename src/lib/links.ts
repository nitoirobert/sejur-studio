// Linkuri folosite în mai multe locuri pe site.

// „Cont nou de gazdă": pagina de cont nou a panoului proprietarului.
// Panoul e deocamdată doar pe ramura owner-dashboard (preview Vercel), deci linkul duce acolo.
// După ce panoul intră în main, se setează NEXT_PUBLIC_HOST_SIGNUP_URL=/cont-nou (sau se schimbă aici).
export const hostSignupUrl =
  process.env.NEXT_PUBLIC_HOST_SIGNUP_URL ??
  "https://sejur-studio-git-owner-dashboard-robert-807b.vercel.app/cont-nou";
