import { PropertyBrowser } from "@/components/browse/PropertyBrowser";

// Pagina publică a unei proprietăți (deocamdată cu date de test).
// Antetul e în PropertyBrowser, fiindcă arată sejurul ales (date + oaspeți).
export default function Home() {
  return (
    <div className="flex w-full flex-col px-4 lg:h-dvh lg:px-6 2xl:px-8">
      <PropertyBrowser />
    </div>
  );
}
