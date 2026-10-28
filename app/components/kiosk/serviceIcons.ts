import { Ambulance, Hospital, Stethoscope, Syringe, TestTube, type LucideIcon } from "lucide-react";

// Kiosk-only icons; `registrasi` uses the BPJS logo image instead.
const ICONS: Record<string, LucideIcon> = {
  poli_umum: Stethoscope,
  igd: Ambulance,
  laboratorium: TestTube,
  vaksinasi: Syringe,
};

export const serviceIcon = (code: string) => ICONS[code] ?? Hospital;
