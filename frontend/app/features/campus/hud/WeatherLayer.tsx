import type { SceneLook } from "../sky";

/**
 * Rain, fog and storm over the scene, as CSS on the compositor: the WebGL scene keeps drawing
 * nothing while idle (weather-time-visuals §2.3–2.5). Between the canvas (z-0) and the world
 * labels (z-10), under the HUD. Static under reduced motion; gone in forced colours and in the
 * "Cố định ban ngày" display (its look is always clear).
 */
export function WeatherLayer({ look }: { look: SceneLook }) {
  const { weather } = look;
  const storm = weather === "thunderstorm";
  const rain = storm || weather === "rain" || weather === "drizzle";
  if (!rain && weather !== "fog") return null;
  return (
    <div aria-hidden="true" className="weather-layer" data-weather={weather}>
      {rain && <div className="weather-rain" data-dense={storm ? "" : undefined} />}
      {weather === "fog" && <div className="weather-fog" />}
      {storm && <div className="weather-storm" />}
      {storm && <div className="weather-flash" />}
    </div>
  );
}
