import { Button } from "~/components/ui/button";

interface Props {
  homePath: string;
  onPrint: () => void;
}

export function QrActions({ homePath, onPrint }: Props) {
  return (
    <nav
      aria-label="Navigasi tiket"
      className="no-print flex w-full items-center justify-between gap-3 border-b border-blue-100 bg-white px-6 py-4"
    >
      <Button asChild variant="secondary" size="lg">
        <a href={homePath}>&larr; Kembali ke Home</a>
      </Button>
      <Button size="lg" onClick={onPrint}>
        🖨️ Cetak via Printer
      </Button>
    </nav>
  );
}
