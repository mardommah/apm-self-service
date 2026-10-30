const ACCOUNTS = [
  { number: "0000000000001", qr: "/dev/bpjs-checkin-dummy-qr.png" },
  { number: "0000000000002", qr: "/dev/bpjs-checkin-dummy-qr-2.png" },
];

/** Dummy BPJS numbers for scanner testing; collapsed so it never competes with daily work. */
export function BpjsTestAccounts() {
  return (
    <details className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm">
      <summary className="cursor-pointer font-semibold text-amber-900">Akun BPJS untuk pengujian</summary>
      <p className="mt-2 text-amber-800">
        Nomor dan QR berikut data dummy untuk menguji scanner. Keduanya tidak terdaftar sebagai peserta BPJS; validasi FKTL
        dan biometrik Frista dapat gagal.
      </p>
      <ul className="mt-3 flex flex-wrap gap-3">
        {ACCOUNTS.map(({ number, qr }) => (
          <li key={number} className="flex items-center gap-3 rounded-lg border border-amber-200 bg-white px-3 py-2">
            <code className="font-semibold text-gray-900">{number}</code>
            <a href={qr} target="_blank" rel="noopener noreferrer" className="font-medium text-blue-700 underline">
              Lihat QR
            </a>
          </li>
        ))}
      </ul>
    </details>
  );
}
