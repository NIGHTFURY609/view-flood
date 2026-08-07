import { useMutation, useQuery } from "@tanstack/react-query";
import { Flag } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { campImagesQuery } from "@/features/camps/api";
import { api } from "@/shared/api/client";
import { Button } from "@/shared/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Textarea } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { useI18n } from "@/shared/i18n";

/**
 * Reporter photos. URLs are signed with a 1 hour TTL, which is why this query
 * is excluded from the offline cache and from service-worker caching — a stale
 * signed URL renders as a broken image.
 */
export function CampPhotos({ campId }: { campId: string }) {
  const { t } = useI18n();
  const images = useQuery(campImagesQuery(campId));
  const [flagging, setFlagging] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  const flag = useMutation({
    mutationFn: (imageId: string) => api.camps.flagImage(campId, imageId, reason.trim()),
    onSuccess: () => {
      toast.success(t("detail.reportImage"));
      setFlagging(null);
      setReason("");
    },
    onError: () => toast.error(t("error.generic")),
  });

  const photos = images.data ?? [];
  if (images.isPending || photos.length === 0) return null;

  return (
    <section className="panel flex flex-col gap-3 p-4">
      <div>
        <h2 className="text-base font-bold text-foreground">{t("detail.photos")}</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">{t("detail.photoNote")}</p>
      </div>

      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {photos.map((photo) => (
          <li key={photo.id} className="relative overflow-hidden rounded-lg border border-border">
            <img
              src={photo.url}
              alt={t("detail.photos")}
              loading="lazy"
              decoding="async"
              width={photo.width ?? undefined}
              height={photo.height ?? undefined}
              className="aspect-[4/3] w-full bg-muted object-cover"
            />
            <button
              type="button"
              onClick={() => setFlagging(photo.id)}
              aria-label={t("detail.reportImage")}
              className="absolute right-1 top-1 grid size-11 place-items-center rounded-lg bg-surface/90 text-muted-foreground backdrop-blur transition-colors duration-(--duration-fast) hover:text-critical"
            >
              <Flag className="size-4" aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>

      <Dialog open={flagging !== null} onOpenChange={(next) => !next && setFlagging(null)}>
        <DialogContent aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>{t("detail.reportImage")}</DialogTitle>
          </DialogHeader>
          <Label htmlFor="flag-reason" className="mb-1.5 block">
            {t("detail.reportImageReason")}
          </Label>
          <Textarea
            id="flag-reason"
            value={reason}
            maxLength={500}
            onChange={(event) => setReason(event.target.value)}
          />
          <DialogFooter>
            <Button variant="ghost" size="md" onClick={() => setFlagging(null)}>
              {t("action.close")}
            </Button>
            <Button
              variant="critical"
              size="md"
              disabled={reason.trim().length < 3 || flag.isPending}
              onClick={() => flagging && flag.mutate(flagging)}
            >
              {t("detail.reportImage")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
