import {
  Ambulance,
  FileText,
  Headset,
  Hospital,
  LayoutGrid,
  Stethoscope,
  Syringe,
  TestTube,
  type LucideIcon,
} from "lucide-react";

// Kiosk-only icons; `registrasi` uses the BPJS logo image instead.
const ICONS: Record<string, LucideIcon> = {
  poli_umum: Stethoscope,
  igd: Ambulance,
  laboratorium: TestTube,
  vaksinasi: Syringe,
  customer_service: Headset,
  surat_keterangan: FileText,
  layanan_lainnya: LayoutGrid,
};

export const serviceIcon = (code: string) => ICONS[code] ?? Hospital;

/** Rendered in the "Layanan Lainnya" strip below the main grid. */
export const OTHER_SERVICE_CODES = ["customer_service", "surat_keterangan", "layanan_lainnya"];
