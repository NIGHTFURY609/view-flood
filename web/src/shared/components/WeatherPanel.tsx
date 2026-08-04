import { useQuery } from "@tanstack/react-query";
import { CloudRain, Thermometer } from "lucide-react";

import { api } from "@/shared/api/client";
import { queryKeys } from "@/shared/api/queryClient";
import { useI18n } from "@/shared/i18n";
import { formatIst } from "@/shared/lib/format";

/**
 * Rain context for the area being browsed.
 *
 * Hides itself entirely on error or empty data rather than rendering zeroes.
 * During a flood, "0 mm of rain" shown because an upstream call failed is
 * actively dangerous — worse than showing nothing.
 */
export function WeatherPanel({
  lat,
  lng,
  placeName,
}: {
  lat: number;
  lng: number;
  placeName: string;
}) {
  const { t } = useI18n();

  const weather = useQuery({
    queryKey: queryKeys.weather(lat, lng),
    queryFn: ({ signal }) => api.weather.at(lat, lng, signal),
    staleTime: 15 * 60_000,
    retry: 0,
  });

  const data = weather.data;
  if (weather.isError || !data || data.temperature_c === null) return null;

  return (
    <section className="panel flex flex-wrap items-center gap-x-5 gap-y-2 px-4 py-3">
      <h2 className="sr-only">
        {t("weather.title")} — {placeName}
      </h2>

      <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <Thermometer className="size-4 text-accent" aria-hidden="true" />
        {Math.round(data.temperature_c)}°C
      </p>

      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <CloudRain className="size-4" aria-hidden="true" />
        <span>
          {t("weather.rain24")}: <strong className="text-foreground">{data.rain_last_24h_mm} mm</strong>
        </span>
      </p>

      <p className="text-sm text-muted-foreground">
        {t("weather.rainNext")}:{" "}
        <strong className="text-foreground">{data.rain_next_24h_mm} mm</strong>
      </p>

      <p className="ml-auto text-xs text-muted-foreground">
        {t("weather.source")}
        {data.observed_at ? ` · ${formatIst(data.observed_at)}` : ""}
      </p>
    </section>
  );
}
