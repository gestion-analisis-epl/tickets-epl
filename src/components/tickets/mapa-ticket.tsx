"use client";

import { useSitios } from "@/hooks/use-sitios";
import { geolocalizacionDelTicket } from "@/domain/sitios/sitios-rules";
import type { SitioArrendamiento } from "@/types/ticket";
import { MapaSitio } from "./mapa-sitio";

interface Props {
  sitio: SitioArrendamiento;
  // Coordenada que guardo el ticket al capturar los datos de alta (respaldo si el catalogo no la trae).
  guardada?: string;
}

// Mapa fijo de la ficha del ticket: la ubicacion sale del catalogo de sitios, no de los datos de alta,
// asi que aparece en cualquier ticket que tenga sitio, nuevo o anterior.
export function MapaDelTicket({ sitio, guardada }: Props) {
  const { sitios, loading } = useSitios();
  const geolocalizacion = geolocalizacionDelTicket(sitios, sitio, guardada);

  if (loading && !geolocalizacion) return <p className="mt-3 text-sm text-muted">Cargando el mapa...</p>;
  return <MapaSitio geolocalizacion={geolocalizacion} mostrarVacio className="mt-3" />;
}
