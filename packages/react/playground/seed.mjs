import { createHmac } from "node:crypto";
import { writeFileSync } from "node:fs";
const B = "http://localhost:8833";
const j = (r) => r.json();
const app = await fetch(B + "/v1/apps", { method: "POST", headers: { authorization: "Bearer local-admin", "content-type": "application/json" }, body: JSON.stringify({ name: "Graiden" }) }).then(j);
const H = (id) => ({ "x-youasked-key": app.publicKey, "x-youasked-user": Buffer.from(JSON.stringify({ id, name: id })).toString("base64url"), "x-youasked-sig": createHmac("sha256", app.secretKey).update(id).digest("hex"), "content-type": "application/json" });
const post = (id, path, body) => fetch(B + "/v1" + path, { method: "POST", headers: H(id), body: JSON.stringify(body) }).then(j);
const admin = (path, method, body) => fetch(B + "/v1/admin" + path, { method, headers: { authorization: "Bearer " + app.secretKey, "content-type": "application/json" }, body: JSON.stringify(body) }).then(j);
const seeds = [
  ["mei", "Split a bill with my partner", "We share groceries and rent. Would love to tag an expense as 50/50 and see who owes who.", 14, "planned"],
  ["raj", "Monthly budget per category", "Set $400 for food and get a heads-up when I'm close.", 11, "in_progress"],
  ["sam", "Dark mode for the charts", "", 8, "shipped", "Charts now follow your theme. Settings → Appearance."],
  ["lin", "Import my DBS statement PDF", "Some of my older expenses never came through email.", 6, "open"],
  ["tom", "Recurring expenses (Netflix, rent)", "", 4, "open"],
  ["ana", "Widget for the home screen", "Just today's total would be enough.", 3, "open"],
];
let shippedId;
for (const [who, title, body, votes, status, note] of seeds) {
  const { request } = await post(who, "/requests", { title, body });
  for (let i = 1; i < votes; i++) await post(`voter${i}`, `/requests/${request.id}/vote`, {});
  if (status !== "open") await admin(`/requests/${request.id}`, "PATCH", { status, shipNote: note });
  if (status === "planned") await admin(`/requests/${request.id}/comments`, "POST", { body: "On the list for December. Would a simple 'who owes who' total be enough to start?" });
  if (title.startsWith("Split")) await post("raj", `/requests/${request.id}/comments`, { body: "Yes! Even just splitting one expense would help." });
  if (status === "shipped") shippedId = request.id;
}
// The playground visitor is "you": vote on the shipped one before it ships would be ideal; instead notify via a fresh request.
const youReq = await post("you", "/requests", { title: "Show which card I paid with", body: "" });
await admin(`/requests/${youReq.request.id}`, "PATCH", { status: "shipped", shipNote: "Each expense now shows the card's last 4 digits." });
const sig = createHmac("sha256", app.secretKey).update("you").digest("hex");
writeFileSync(new URL("./keys.json", import.meta.url), JSON.stringify({ publicKey: app.publicKey, sig }));
console.log("seeded", seeds.length + 1, "requests");
