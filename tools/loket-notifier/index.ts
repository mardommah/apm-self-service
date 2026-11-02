import { arrived, seenOf, toastXml, type ServiceNewest } from "./notify";

const server = (process.env.NOTIFIER_SERVER ?? "").replace(/\/$/, "");
const key = process.env.NOTIFIER_KEY ?? "";
const intervalMs = Number(process.env.NOTIFIER_INTERVAL_MS ?? 5_000);
if (!server || key.length < 32) throw new Error("Set NOTIFIER_SERVER (mis. http://192.168.1.127:3886) dan NOTIFIER_KEY (>=32 karakter)");

// Windows PowerShell 5.1 WinRT toast, shown under PowerShell's own app id (no installer / shortcut needed).
const TOAST_PS = `
[Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null
[Windows.Data.Xml.Dom.XmlDocument, Windows.Data.Xml.Dom.XmlDocument, ContentType = WindowsRuntime] | Out-Null
$xml = New-Object Windows.Data.Xml.Dom.XmlDocument
$xml.LoadXml($env:TOAST_XML)
[Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier('{1AC14E77-02E7-4E5D-B744-2EB1AE5198B7}\\WindowsPowerShell\\v1.0\\powershell.exe').Show([Windows.UI.Notifications.ToastNotification]::new($xml))`;

async function showToast(items: ServiceNewest[]) {
  // XML goes through the environment, never into the command line.
  const proc = Bun.spawn(["powershell.exe", "-NoProfile", "-NonInteractive", "-Command", TOAST_PS], {
    env: { ...process.env, TOAST_XML: toastXml(items) },
    stdout: "ignore",
    stderr: "pipe",
  });
  if ((await proc.exited) !== 0) console.error("[toast]", await new Response(proc.stderr).text());
}

let seen: Record<string, string | null> | undefined;

async function poll() {
  try {
    const res = await fetch(`${server}/api/loket-newest`, {
      headers: { authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const state = (await res.json()) as ServiceNewest[];
    // First poll only seeds, like the dashboard toast.
    const items = seen ? arrived(seen, state) : [];
    seen = seenOf(state);
    if (items.length) {
      console.log(new Date().toLocaleTimeString(), items.map((s) => `${s.label} ${s.newest!.queueNumber}`).join(", "));
      await showToast(items);
    }
  } catch (error) {
    console.error(new Date().toLocaleTimeString(), "[poll]", error instanceof Error ? error.message : error);
  } finally {
    setTimeout(poll, intervalMs);
  }
}

console.log(`Loket notifier: ${server} tiap ${intervalMs / 1000} detik`);
poll();
