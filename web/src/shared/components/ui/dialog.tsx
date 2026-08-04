import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ComponentProps } from "react";

import { cn } from "@/shared/lib/cn";

/**
 * Radix gives us role="dialog", aria-modal, a focus trap, Escape-to-close and
 * return-focus-on-close for free. The prototype hand-rolled a modal and had
 * none of them.
 */
export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

export function DialogContent({
  className,
  children,
  showClose = true,
  ...props
}: ComponentProps<typeof DialogPrimitive.Content> & { showClose?: boolean }) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay
        className={cn(
          "fixed inset-0 z-(--z-overlay) bg-primary/50 backdrop-blur-[2px]",
          "data-[state=open]:animate-in data-[state=open]:fade-in-0",
          "data-[state=closed]:animate-out data-[state=closed]:fade-out-0",
        )}
      />
      <DialogPrimitive.Content
        className={cn(
          "fixed z-(--z-dialog) bg-surface shadow-overlay",
          // Bottom sheet on phones, centred card from sm up.
          "inset-x-0 bottom-0 max-h-[90dvh] overflow-y-auto rounded-t-2xl border-t border-border p-5",
          "sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:w-full sm:max-w-lg",
          "sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl sm:border",
          "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-bottom-4",
          "data-[state=closed]:animate-out data-[state=closed]:fade-out-0",
          "sm:data-[state=open]:zoom-in-95 sm:data-[state=open]:slide-in-from-bottom-0",
          className,
        )}
        {...props}
      >
        {children}
        {showClose ? (
          <DialogPrimitive.Close
            className={cn(
              "absolute right-3 top-3 inline-flex size-11 items-center justify-center",
              "rounded-lg text-muted-foreground cursor-pointer",
              "transition-colors duration-(--duration-fast) hover:bg-secondary hover:text-foreground",
            )}
          >
            <X className="size-5" aria-hidden="true" />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        ) : null}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

export function DialogHeader({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("mb-4 flex flex-col gap-1 pr-12", className)} {...props} />;
}

export function DialogFooter({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn("mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", className)}
      {...props}
    />
  );
}

export function DialogTitle({
  className,
  ...props
}: ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      className={cn("text-lg font-bold text-foreground text-balance", className)}
      {...props}
    />
  );
}

export function DialogDescription({
  className,
  ...props
}: ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  );
}
