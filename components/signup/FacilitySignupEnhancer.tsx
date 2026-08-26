"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  isValidSwedishFacilityId,
  normalizeSwedishFacilityId,
} from "@/lib/website/signupValidation";

function setReactInputValue(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    "value",
  )?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

function syncFacilityToMeteringPoint(facilityId: string) {
  const meteringInput = document.getElementById("metering_point_id") as HTMLInputElement | null;
  if (!meteringInput) return;
  if (!meteringInput.value.trim() || meteringInput.dataset.gridexFacilityMirror === "true") {
    setReactInputValue(meteringInput, facilityId);
    meteringInput.dataset.gridexFacilityMirror = "true";
  }
}

function clearMirroredMeteringPoint(previousFacilityId: string) {
  const meteringInput = document.getElementById("metering_point_id") as HTMLInputElement | null;
  if (!meteringInput) return;
  const meterValue = normalizeSwedishFacilityId(meteringInput.value);
  const previousValue = normalizeSwedishFacilityId(previousFacilityId);
  if (meteringInput.dataset.gridexFacilityMirror === "true" || (previousValue && meterValue === previousValue)) {
    setReactInputValue(meteringInput, "");
    delete meteringInput.dataset.gridexFacilityMirror;
  }
}

export default function FacilitySignupEnhancer() {
  const [facilityFieldHost, setFacilityFieldHost] = useState<HTMLElement | null>(null);
  const [facilityIdUnavailable, setFacilityIdUnavailable] = useState(false);
  const [facilityError, setFacilityError] = useState<string | null>(null);
  const facilityIdUnavailableRef = useRef(false);

  useEffect(() => {
    let wiredInput: HTMLInputElement | null = null;
    let cleanupInput: (() => void) | null = null;

    const wireInput = () => {
      const facilityInput = document.getElementById("facility_id") as HTMLInputElement | null;
      if (facilityInput === wiredInput) return;

      cleanupInput?.();
      cleanupInput = null;
      wiredInput = facilityInput;

      if (!facilityInput) {
        setFacilityFieldHost(null);
        return;
      }

      setFacilityFieldHost(facilityInput.parentElement as HTMLElement | null);
      facilityInput.inputMode = "numeric";
      facilityInput.autocomplete = "off";
      facilityInput.setAttribute("aria-describedby", "facility-id-guidance facility-id-error");

      const details = facilityInput.closest("details") as HTMLDetailsElement | null;
      const summary = details?.querySelector("summary");
      if (summary && summary.textContent !== "Anläggningsuppgifter") {
        summary.textContent = "Anläggningsuppgifter";
      }

      const intro = details?.querySelector("summary + p") as HTMLParagraphElement | null;
      const introText =
        "Fyll gärna i ditt Anläggnings-ID så kan Gridex snabbare gå vidare med leverantörsbytet. Har du det inte tillgängligt fortsätter fullmaktsflödet som vanligt.";
      if (intro && intro.textContent !== introText) intro.textContent = introText;

      const onInput = () => {
        setFacilityError(null);
        if (facilityInput.value.trim() && facilityIdUnavailableRef.current) {
          facilityIdUnavailableRef.current = false;
          setFacilityIdUnavailable(false);
        }
      };
      facilityInput.addEventListener("input", onInput);
      cleanupInput = () => facilityInput.removeEventListener("input", onInput);
    };

    const revealFacilityField = (input: HTMLInputElement) => {
      const details = input.closest("details") as HTMLDetailsElement | null;
      if (details) details.open = true;
      window.requestAnimationFrame(() => {
        details?.scrollIntoView({ behavior: "smooth", block: "center" });
        input.focus();
      });
    };

    const onClickCapture = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const button = target?.closest("button");
      if (!button || button.type !== "button" || button.textContent?.trim() !== "Granska teckningen") {
        return;
      }

      const currentInput = document.getElementById("facility_id") as HTMLInputElement | null;
      if (!currentInput) return;

      const raw = currentInput.value.trim();
      if (facilityIdUnavailableRef.current) {
        if (raw) {
          clearMirroredMeteringPoint(raw);
          setReactInputValue(currentInput, "");
        }
        setFacilityError(null);
        return;
      }

      if (!raw) {
        event.preventDefault();
        event.stopPropagation();
        setFacilityError(
          "Ange ditt Anläggnings-ID eller bocka i att du inte har det tillgängligt just nu.",
        );
        revealFacilityField(currentInput);
        return;
      }

      if (!isValidSwedishFacilityId(raw)) {
        event.preventDefault();
        event.stopPropagation();
        setFacilityError(
          "Kontrollera Anläggnings-ID. Det ska bestå av 18 siffror och börja med 735999.",
        );
        revealFacilityField(currentInput);
        return;
      }

      const normalized = normalizeSwedishFacilityId(raw);
      if (normalized !== raw) setReactInputValue(currentInput, normalized);
      syncFacilityToMeteringPoint(normalized);
      setFacilityError(null);
    };

    wireInput();
    document.addEventListener("click", onClickCapture, true);
    const observer = new MutationObserver(wireInput);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      document.removeEventListener("click", onClickCapture, true);
      cleanupInput?.();
    };
  }, []);

  if (!facilityFieldHost) return null;

  return createPortal(
    <div className="mt-3 space-y-3">
      <p id="facility-id-guidance" className="text-xs leading-5 text-white/55">
        Du hittar Anläggnings-ID på din elnätsfaktura. Det består av 18 siffror och börjar normalt med 735999.
      </p>
      <label className="flex items-start gap-3 text-sm leading-6 text-gray-300">
        <input
          type="checkbox"
          checked={facilityIdUnavailable}
          onChange={(event) => {
            const checked = event.target.checked;
            facilityIdUnavailableRef.current = checked;
            setFacilityIdUnavailable(checked);
            setFacilityError(null);
            if (checked) {
              const input = document.getElementById("facility_id") as HTMLInputElement | null;
              if (input) {
                clearMirroredMeteringPoint(input.value);
                setReactInputValue(input, "");
              }
            }
          }}
          className="mt-1 h-4 w-4 rounded border-white/20 bg-black/40 focus:ring-2 focus:ring-cyan-500/40"
        />
        <span>
          Jag har inte mitt Anläggnings-ID tillgängligt just nu. Gridex får använda fullmakten för att komplettera uppgifterna.
        </span>
      </label>
      {facilityError ? (
        <p id="facility-id-error" role="alert" className="text-xs leading-5 text-red-200">
          {facilityError}
        </p>
      ) : (
        <span id="facility-id-error" />
      )}
    </div>,
    facilityFieldHost,
  );
}
