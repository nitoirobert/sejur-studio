"use client";

import { useEffect, useId, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Plus } from "lucide-react";
import { createProperty } from "@/app/dashboard/proprietati/actions";
import { Sheet } from "@/components/dashboard/booking/Sheet";
import { LIMITS } from "./schema";
import { useSave } from "./client";
import { Field, FormMessage, SubmitButton, actionBar, described, ghost, input, primary } from "./ui";

/* "Adaugă proprietate": name + city in a sheet; the new property opens on its Detalii tab. */
export function CreateProperty({ variant = "primary" }: { variant?: "primary" | "inline" }) {
  const t = useTranslations("Dashboard.properties.create");
  const tList = useTranslations("Dashboard.properties.list");
  const [open, setOpen] = useState(false);
  const [key, setKey] = useState(0);
  const router = useRouter();

  // Next keeps the previous route mounted but hidden after a navigation; a modal <dialog> left open
  // there stays in the top layer and makes the new page inert. Close it whenever this unmounts or hides.
  useEffect(
    () => () => {
      const dialog = document.querySelector<HTMLDialogElement>('dialog[data-testid="property-create-sheet"]');
      if (dialog?.open) dialog.close();
    },
    [],
  );

  return (
    <>
      <button
        type="button"
        data-testid={variant === "primary" ? "property-add" : "property-add-empty"}
        onClick={() => {
          setKey((k) => k + 1);
          setOpen(true);
        }}
        className={`${primary} px-5`}
      >
        <Plus className="size-4" aria-hidden />
        {tList("add")}
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title={t("title")} closeLabel={t("close")} testId="property-create-sheet">
        <CreateForm
          key={key}
          onCancel={() => setOpen(false)}
          onCreated={(id) => {
            // Close the sheet first, then navigate: the new page must not open under a modal.
            setOpen(false);
            router.push(`/dashboard/proprietati/${id}`);
          }}
        />
      </Sheet>
    </>
  );
}

function CreateForm({ onCancel, onCreated }: { onCancel: () => void; onCreated: (id: string) => void }) {
  const t = useTranslations("Dashboard.properties.create");
  const id = useId();
  const { pending, run, fieldError, formError } = useSave();
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const nameError = fieldError("name");
  const cityError = fieldError("city");

  return (
    <form
      data-testid="property-create-form"
      noValidate
      className="flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        run(
          () => createProperty({ name, city }),
          (r) => onCreated(r.id),
        );
      }}
    >
      <p className="-mt-1 text-[14px] leading-relaxed text-ink-soft">{t("hint")}</p>
      <Field id={`${id}-name`} label={t("name")} error={nameError}>
        <input
          id={`${id}-name`}
          data-testid="property-create-name"
          data-autofocus
          className={input}
          value={name}
          maxLength={LIMITS.propertyName}
          placeholder={t("namePlaceholder")}
          autoComplete="off"
          onChange={(e) => setName(e.target.value)}
          {...described(`${id}-name`, nameError)}
        />
      </Field>
      <Field id={`${id}-city`} label={t("city")} optional={t("optional")} error={cityError}>
        <input
          id={`${id}-city`}
          data-testid="property-create-city"
          className={input}
          value={city}
          maxLength={LIMITS.city}
          placeholder={t("cityPlaceholder")}
          autoComplete="address-level2"
          onChange={(e) => setCity(e.target.value)}
          {...described(`${id}-city`, cityError)}
        />
      </Field>
      <div aria-live="polite">{formError && <FormMessage testId="property-create-error" tone="error">{formError}</FormMessage>}</div>
      <div className={actionBar}>
        <button type="button" onClick={onCancel} disabled={pending} className={ghost}>
          {t("cancel")}
        </button>
        <SubmitButton pending={pending} label={t("submit")} pendingLabel={t("pending")} testId="property-create-submit" className="px-6 sm:flex-none" />
      </div>
    </form>
  );
}
