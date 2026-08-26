import type { ReactNode } from "react";
import FacilitySignupEnhancer from "@/components/signup/FacilitySignupEnhancer";

export default function TecknaAvtalLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <FacilitySignupEnhancer />
    </>
  );
}
