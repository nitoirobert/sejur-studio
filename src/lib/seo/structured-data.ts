import { nightly, type Unit } from "@/lib/mock-units";
import { SITE_NAME, SITE_URL } from "@/lib/site";

/*
  Date structurate schema.org pentru Google.
  - Pagina de start: WebSite (cu căutare) + organizația.
  - Pagina unei cazări: LodgingBusiness cu adresă, coordonate, poze, facilități și prețul de la.
  Fără note sau recenzii: Google cere ca ele să vină din recenzii reale, vizibile pe pagină.
*/

const ORG_ID = `${SITE_URL}/#organizatie`;

export function homeJsonLd() {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": ORG_ID,
        name: SITE_NAME,
        url: SITE_URL,
        logo: `${SITE_URL}/logo.png`,
      },
      {
        "@type": "WebSite",
        "@id": `${SITE_URL}/#site`,
        name: SITE_NAME,
        url: SITE_URL,
        inLanguage: "ro-RO",
        publisher: { "@id": ORG_ID },
      },
    ],
  };
}

const amenityNames: Record<string, string> = {
  wifi: "Wi-Fi",
  parking: "Parcare",
  breakfast: "Mic dejun",
  kitchen: "Bucătărie",
  fireplace: "Șemineu",
  pets: "Animale permise",
  ac: "Aer condiționat",
  view: "Priveliște",
  sea: "Lângă mare",
  pool: "Piscină",
};

export function unitJsonLd(u: Unit) {
  const [locality, region] = u.location.split(",").map((s) => s.trim());
  const lei = Math.round(nightly(u) / 100);
  return {
    "@context": "https://schema.org",
    "@type": "LodgingBusiness",
    "@id": `${SITE_URL}/cazare/${u.id}`,
    name: u.name,
    description: u.description,
    url: `${SITE_URL}/cazare/${u.id}`,
    image: u.hasPhotos ? u.photos : undefined,
    priceRange: `de la ${lei} lei / noapte`,
    currenciesAccepted: "RON",
    checkinTime: u.checkIn,
    checkoutTime: u.checkOut,
    petsAllowed: u.amenities.includes("pets"),
    numberOfRooms: u.bedrooms,
    address: {
      "@type": "PostalAddress",
      addressLocality: locality || undefined,
      addressRegion: region || undefined,
      addressCountry: "RO",
    },
    geo: u.lat !== null && u.lng !== null ? { "@type": "GeoCoordinates", latitude: u.lat, longitude: u.lng } : undefined,
    amenityFeature: u.amenities.map((a) => ({
      "@type": "LocationFeatureSpecification",
      name: amenityNames[a] ?? a,
      value: true,
    })),
    brand: { "@id": ORG_ID },
  };
}
