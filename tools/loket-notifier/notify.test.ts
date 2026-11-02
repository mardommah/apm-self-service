import { expect, test } from "bun:test";
import { arrived, seenOf, toastXml, type ServiceNewest } from "./notify";

const state = (id: string | null): ServiceNewest[] => [
  { serviceCode: "registrasi", label: "BPJS <&>", waiting: 2, newest: id ? { id, queueNumber: "A005" } : null },
];

test("only a changed newest ticket counts as arrived", () => {
  expect(arrived(seenOf(state("v1")), state("v1"))).toHaveLength(0);
  expect(arrived(seenOf(state("v1")), state(null))).toHaveLength(0);
  expect(arrived(seenOf(state(null)), state("v2"))).toHaveLength(1);
});

test("toast text is XML-escaped", () => {
  expect(toastXml(state("v1"))).toContain("BPJS &lt;&amp;&gt;: A005 (2 menunggu)");
});
