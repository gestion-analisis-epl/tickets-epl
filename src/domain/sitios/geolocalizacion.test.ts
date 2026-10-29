import { describe, it, expect } from "vitest";
import { geolocalizacionValida, parsearGeolocalizacion, urlGoogleMaps, urlMapaEmbebido } from "./geolocalizacion";

describe("parsearGeolocalizacion", () => {
  it("lee latitud y longitud, con o sin espacio despues de la coma", () => {
    expect(parsearGeolocalizacion("21.05766938859238,-101.57943964004517")).toEqual({ lat: 21.05766938859238, lng: -101.57943964004517 });
    expect(parsearGeolocalizacion("21.043621, -101.562534")).toEqual({ lat: 21.043621, lng: -101.562534 });
  });
  it("tolera espacios alrededor y enteros", () => {
    expect(parsearGeolocalizacion("  20 , -100  ")).toEqual({ lat: 20, lng: -100 });
  });
  it("descarta lo que no es una coordenada real: N/A, 0, vacio, texto, nulos", () => {
    for (const malo of ["N/A", "n/a", "0", "", "  ", "sin dato", "21.05", "21.05;-101.5", "21.05,-101.5,3", null, undefined]) {
      expect(parsearGeolocalizacion(malo)).toBeNull();
    }
  });
  it("descarta 0,0 y valores fuera de rango", () => {
    expect(parsearGeolocalizacion("0,0")).toBeNull();
    expect(parsearGeolocalizacion("0.0, 0.0")).toBeNull();
    expect(parsearGeolocalizacion("91,-100")).toBeNull();
    expect(parsearGeolocalizacion("20,-181")).toBeNull();
  });
  it("acepta el cero en una sola coordenada", () => {
    expect(parsearGeolocalizacion("0,-100")).toEqual({ lat: 0, lng: -100 });
  });
});

describe("geolocalizacionValida", () => {
  it("devuelve el texto normalizado lat,lng, o null si no es valida", () => {
    expect(geolocalizacionValida("21.043621, -101.562534")).toBe("21.043621,-101.562534");
    expect(geolocalizacionValida("N/A")).toBeNull();
  });
});

describe("urls del mapa", () => {
  const p = { lat: 21.043621, lng: -101.562534 };
  it("el mapa embebido apunta a OpenStreetMap con el punto marcado", () => {
    const url = urlMapaEmbebido(p);
    expect(url.startsWith("https://www.openstreetmap.org/export/embed.html?")).toBe(true);
    expect(url).toContain("marker=21.043621%2C-101.562534");
    expect(url).toContain("bbox=");
  });
  it("el enlace a Google Maps lleva las coordenadas", () => {
    expect(urlGoogleMaps(p)).toBe("https://www.google.com/maps?q=21.043621,-101.562534");
  });
});
