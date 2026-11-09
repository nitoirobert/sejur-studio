// Linkuri folosite în mai multe locuri pe site.

// „Cont nou de gazdă": pagina de cont nou a panoului proprietarului (din același site).
// Se poate suprascrie cu NEXT_PUBLIC_HOST_SIGNUP_URL (ex. spre un preview Vercel).
export const hostSignupUrl = process.env.NEXT_PUBLIC_HOST_SIGNUP_URL ?? "/cont-nou";

// „Contul tău de gazdă": panoul proprietarului, când gazda e deja logată.
export const hostDashboardUrl = "/dashboard";
