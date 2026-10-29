import { ExternalLink } from "lucide-react";
import { parsearGeolocalizacion, urlGoogleMaps, urlMapaEmbebido } from "@/domain/sitios/geolocalizacion";

interface Props {
  geolocalizacion: string | null | undefined;
  className?: string;
  // Sin coordenada valida: en la ficha del ticket muestra un aviso en lugar de ocultarse.
  mostrarVacio?: boolean;
}

// Mapa del sitio con su punto marcado. Sin coordenada valida no pinta nada, salvo con mostrarVacio.
export function MapaSitio({ geolocalizacion, className = "", mostrarVacio = false }: Props) {
  const coordenada = parsearGeolocalizacion(geolocalizacion);
  if (!coordenada) {
    return mostrarVacio ? (
      <div className={`flex h-24 items-center justify-center rounded-md border border-dashed border-border bg-surface px-4 text-center text-sm text-muted ${className}`}>
        Este sitio no tiene ubicación registrada.
      </div>
    ) : null;
  }

  return (
    <div className={`space-y-2 ${className}`}>
      <iframe
        title="Ubicación del sitio en el mapa"
        src={urlMapaEmbebido(coordenada)}
        loading="lazy"
        referrerPolicy="no-referrer"
        sandbox="allow-scripts allow-same-origin"
        className="h-64 w-full rounded-md border border-border"
      />
      <a
        href={urlGoogleMaps(coordenada)}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
      >
        <ExternalLink className="h-3.5 w-3.5" />
        Abrir en Google Maps
      </a>
    </div>
  );
}
