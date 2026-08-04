import { Camera, Trash2, TriangleAlert } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { MAX_PHOTOS, MIN_PHOTOS } from "@/features/report/schema";
import { Button } from "@/shared/components/ui/button";
import { useI18n, type DictKey } from "@/shared/i18n";
import { processImage, warningKeyFor, type ProcessedImage } from "@/shared/lib/imageProcessing";

/**
 * Photos are downscaled, quality-scored and hashed entirely in the browser
 * before upload — on a flooded-area connection, sending a 6 MB original that
 * the server then rejects is a wasted minute the reporter does not have.
 */
export function StepPhotos({
  photos,
  onChange,
  error,
}: {
  photos: readonly ProcessedImage[];
  onChange: (next: ProcessedImage[]) => void;
  error?: string | undefined;
}) {
  const { t } = useI18n();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setBusy(true);

    const accepted: ProcessedImage[] = [];
    for (const file of Array.from(files).slice(0, MAX_PHOTOS - photos.length)) {
      const result = await processImage(file);

      if ("error" in result) {
        toast.error(t(result.error as DictKey));
        continue;
      }
      if (photos.some((p) => p.sha256 === result.sha256)) {
        toast.error(t("error.samePhoto"));
        continue;
      }

      const warning = warningKeyFor(result.qualityReasons);
      // A warning is advice, not a rejection: a blurry photo of a real camp is
      // still evidence.
      if (warning) toast.warning(t(warning as DictKey));

      accepted.push(result);
    }

    if (accepted.length > 0) onChange([...photos, ...accepted]);
    setBusy(false);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground text-pretty">{t("report.photoGuidance")}</p>

      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {photos.map((photo, index) => (
          <li key={photo.sha256} className="relative overflow-hidden rounded-lg border border-border">
            <img
              src={photo.dataUrl}
              alt={`${t("report.photos")} ${index + 1}`}
              className="aspect-[4/3] w-full bg-muted object-cover"
            />
            {photo.qualityReasons.length > 0 ? (
              <span className="absolute left-1 top-1 grid size-6 place-items-center rounded bg-unverified-soft text-unverified">
                <TriangleAlert className="size-3.5" aria-hidden="true" />
              </span>
            ) : null}
            <button
              type="button"
              onClick={() => onChange(photos.filter((p) => p.sha256 !== photo.sha256))}
              aria-label={`${t("action.clear")} ${index + 1}`}
              className="absolute right-1 top-1 grid size-11 place-items-center rounded-lg bg-surface/90 text-muted-foreground backdrop-blur transition-colors duration-(--duration-fast) hover:text-critical"
            >
              <Trash2 className="size-4" aria-hidden="true" />
            </button>
          </li>
        ))}

        {photos.length < MAX_PHOTOS ? (
          <li>
            <Button
              type="button"
              variant="outline"
              onClick={() => inputRef.current?.click()}
              disabled={busy}
              className="aspect-[4/3] h-auto w-full flex-col gap-2"
            >
              <Camera className="size-6 text-accent" aria-hidden="true" />
              {busy ? t("list.loading") : t("report.addPhoto")}
            </Button>
          </li>
        ) : null}
      </ul>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        className="sr-only"
        onChange={(event) => void handleFiles(event.target.files)}
      />

      <p className="text-xs text-muted-foreground">
        {photos.length} / {MAX_PHOTOS} · {t("report.photos")}
      </p>

      {error ? (
        <p role="alert" className="text-xs font-medium text-critical">
          {t(error as DictKey)}
        </p>
      ) : null}
      {photos.length < MIN_PHOTOS && !error ? (
        <p className="text-xs text-muted-foreground">{t("error.minPhotos")}</p>
      ) : null}
    </div>
  );
}
