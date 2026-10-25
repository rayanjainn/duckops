/* Provisioning line: figure script, built by figures/duckops-line.mjs */
(function(){
"use strict";
const k = window.isoKit;
const D = {"P":{"origin":[330,197.1196386636934],"scale":1.6103735527672058,"azimuth":62,"elevation":30},"XS":[-91,-65,-39,-13,13,39,65,91],"STAGES":[["Initializing","project saved, job queued"],["Scaffolding","code rendered from templates"],["Creating repo","GitHub repo created and pushed"],["Provisioning","image built, namespace by Terraform"],["Configuring","Ansible deploys to Kubernetes"],["Pipeline ready","Jenkins job created"],["Deploying","first build running"],["Running","/health checked every 30 s"]],"START":-117,"PRESS":4.4,"CRATE":18,"DRUM_X":118,"BELT_Y":12,"BELT_TOP":12,"CRATE_SVG":"<path class=\"iso-halo\" d=\"M306.2 178.8L306.3 178.6L306.5 178.3L321.1 164.6L321.4 164.4L321.8 164.2L322.2 164L322.8 163.9L323.3 163.9L323.9 163.9L324.4 163.9L324.9 164L352.3 171.3L352.7 171.5L353.1 171.7L353.4 171.9L353.7 172.2L353.8 172.4L353.8 172.7L353.8 172.9L353.7 173.2L353.5 173.4L338.9 187.1L338.6 187.3L338.2 187.5L337.8 187.7L337.2 187.8L336.7 187.8L336.1 187.8L335.6 187.8L335.1 187.7L307.7 180.4L307.3 180.3L306.9 180.1L306.6 179.8L306.3 179.6L306.2 179.3L306.2 179Z\" style=\"filter:blur(3px)\"/><g class=\"iso-solid\" data-lit=\"\"><path class=\"iso-fill\" d=\"M306.2 163.3L306.5 162.6L321.1 148.9L322.1 148.4L323.5 148.2L324.9 148.3L352.3 155.6L353.4 156.1L353.8 156.8L353.8 172.7L353.5 173.4L338.9 187.1L337.9 187.6L336.5 187.8L335.1 187.7L307.7 180.4L306.6 179.9L306.2 179.2Z\"/><path class=\"iso-shade\" data-shade=\"0\" d=\"M353.8 172.7L353.5 173.4L353.5 157.5L353.8 156.8ZM353.5 173.4L338.9 187.1L338.9 171.2L353.5 157.5ZM338.9 187.1L337.9 187.6L337.9 171.8L338.9 171.2Z\"/><path class=\"iso-shade\" data-shade=\"1\" d=\"M337.9 187.6L336.5 187.8L336.5 172L337.9 171.8Z\"/><path class=\"iso-shade\" data-shade=\"2\" d=\"M336.5 187.8L335.1 187.7L335.1 171.8L336.5 172ZM335.1 187.7L307.7 180.4L307.7 164.5L335.1 171.8Z\"/><path class=\"iso-shade\" data-shade=\"3\" d=\"M307.7 180.4L306.6 179.9L306.6 164L307.7 164.5ZM306.6 179.9L306.2 179.2L306.2 163.3L306.6 164Z\"/><path class=\"iso-top\" d=\"M352.3 155.6L353.4 156.1L353.8 156.8L353.5 157.5L338.9 171.2L337.9 171.8L336.5 172L335.1 171.8L307.7 164.5L306.6 164L306.2 163.3L306.5 162.6L321.1 148.9L322.1 148.4L323.5 148.2L324.9 148.3Z\"/><path class=\"iso-line iso-crease\" data-tone=\"lo\" d=\"M353.8 156.8L353.5 157.5L338.9 171.2L337.9 171.8L336.5 172L335.1 171.8L307.7 164.5L306.6 164L306.2 163.3\"/><path class=\"iso-line iso-bevel\" data-tone=\"lo\" d=\"M353.8 156.8L352.3 157.3L337.9 170.9L337.3 171.2L336.5 171.4L335.5 171.2L308.4 164L307.7 163.7L306.2 163.3\"/><path class=\"iso-line\" data-tone=\"faint\" d=\"M353.8 168.8L353.5 169.5L338.9 183.2L337.9 183.7L336.5 184L335.1 183.8L307.7 176.5L306.6 176L306.2 175.3\"/><path class=\"iso-line iso-edge\" data-tone=\"hi\" d=\"M306.2 163.3L306.5 162.6L321.1 148.9L322.1 148.4L323.5 148.2L324.9 148.3L352.3 155.6L353.4 156.1L353.8 156.8M353.8 172.7L353.5 173.4L338.9 187.1L337.9 187.6L336.5 187.8L335.1 187.7L307.7 180.4L306.6 179.9L306.2 179.2M353.8 156.8L353.8 172.7M306.2 163.3L306.2 179.2\"/></g><path class=\"iso-line\" data-tone=\"lo\" d=\"M350.4 157L336.2 170.3L309.6 163.2L323.8 149.9Z\"/><path class=\"fig-mark\" data-mark=\"0\" d=\"M324.8 155.9L324.2 156.3L323.3 156.5L322.3 156.5L321.4 156.3L320.8 155.9L320.6 155.4L320.9 154.9L321.5 154.5L322.4 154.3L323.4 154.3L324.3 154.6L324.9 155L325.1 155.5Z\"/><path class=\"fig-mark\" data-mark=\"1\" d=\"M331.1 157.6L330.5 158L329.6 158.2L328.6 158.2L327.7 157.9L327.1 157.5L326.9 157L327.2 156.6L327.8 156.2L328.7 156L329.7 156L330.6 156.2L331.2 156.6L331.4 157.1Z\"/><path class=\"fig-mark\" data-mark=\"2\" d=\"M337.4 159.3L336.8 159.7L335.9 159.9L334.9 159.8L334 159.6L333.4 159.2L333.2 158.7L333.5 158.2L334.1 157.8L335 157.7L336 157.7L336.9 157.9L337.5 158.3L337.7 158.8Z\"/><path class=\"fig-mark\" data-mark=\"3\" d=\"M343.7 161L343.1 161.3L342.1 161.5L341.2 161.5L340.3 161.3L339.7 160.9L339.5 160.4L339.8 159.9L340.4 159.5L341.3 159.3L342.3 159.3L343.2 159.6L343.8 160L344 160.5Z\"/><path class=\"fig-mark\" data-mark=\"4\" d=\"M320.2 160.2L319.6 160.6L318.7 160.8L317.7 160.8L316.8 160.6L316.2 160.2L316 159.7L316.3 159.2L316.9 158.8L317.9 158.6L318.8 158.6L319.7 158.9L320.3 159.3L320.5 159.8Z\"/><path class=\"fig-mark\" data-mark=\"5\" d=\"M326.5 161.9L325.9 162.3L325 162.5L324 162.5L323.1 162.2L322.5 161.8L322.3 161.4L322.6 160.9L323.2 160.5L324.1 160.3L325.1 160.3L326 160.5L326.6 161L326.8 161.4Z\"/><path class=\"fig-mark\" data-mark=\"6\" d=\"M332.8 163.6L332.2 164L331.3 164.2L330.3 164.2L329.4 163.9L328.8 163.5L328.6 163L328.9 162.5L329.5 162.2L330.4 162L331.4 162L332.3 162.2L332.9 162.6L333.1 163.1Z\"/><path class=\"fig-mark\" data-mark=\"7\" d=\"M339.1 165.3L338.5 165.6L337.6 165.8L336.6 165.8L335.7 165.6L335.1 165.2L334.9 164.7L335.2 164.2L335.8 163.8L336.7 163.6L337.7 163.7L338.6 163.9L339.2 164.3L339.4 164.8Z\"/>"};
function mount(root){

const P = D.P, XS = D.XS, STAGES = D.STAGES;
const stage = root.querySelector(".iso-stage");
const svg = stage.querySelector("svg");
const slots = [...svg.querySelectorAll("[data-slot]")];
const rods = [...svg.querySelectorAll("[data-rod]")];
const lamps = [...svg.querySelectorAll("[data-lamp]")];
const belt = svg.querySelector('[data-part="belt"]');
const readout = root.querySelector("[data-readout]");
const still = matchMedia("(prefers-reduced-motion: reduce)");
const crate = document.createElementNS("http://www.w3.org/2000/svg", "g");
crate.innerHTML = D.CRATE_SVG;
const marks = [...crate.querySelectorAll("[data-mark]")];
let x = D.START, target = D.START, alpha = 0, done = 0, at = -1, phase = "in", clock = 0, travel = 0, pings = 0;
const press = XS.map(() => ({ at: 0, rate: 0, want: 0 }));
let frame = 0, last = 0, visible = false;
const say = (text) => { if (readout.textContent !== text) readout.textContent = text; };
function place() {
  let n = 0;
  XS.forEach((hx) => { if (hx + 5 < x - D.CRATE / 2) n++; });
  if (crate.parentNode !== slots[n]) slots[n].appendChild(crate);
}
function draw() {
  crate.setAttribute("transform", k.translateAlong(P, [x, 0, 0]));
  crate.style.opacity = alpha.toFixed(3);
  place();
  marks.forEach((el, i) => el.setAttribute("data-on", i < done ? "1" : "0"));
  lamps.forEach((el, i) => el.setAttribute("data-state", i < done ? "done" : i === at ? "active" : ""));
  rods.forEach((el, i) => el.setAttribute("transform", k.translateAlong(P, [0, 0, -press[i].at])));
  let d = "";
  const off = ((travel % 6) + 6) % 6;
  for (let bx = -D.DRUM_X + off; bx < D.DRUM_X; bx += 6) d += k.lineOnTop([bx, -D.BELT_Y], [bx, D.BELT_Y], D.BELT_TOP, P);
  belt.innerHTML = '<path class="iso-line" data-tone="faint" d="' + d + '"/>';
}
function enter(next) { phase = next; clock = 0; }
function tick(now) {
  const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
  last = now;
  const calm = still.matches;
  clock += dt;
  const ease = (v, w, tau) => calm ? w : v + (w - v) * (1 - Math.exp(-dt / tau));
  switch (phase) {
    case "in":
      alpha = ease(alpha, 1, 0.2);
      say("new project · stack picked");
      if (clock > 0.8) { alpha = 1; at = 0; target = XS[0]; enter("move"); }
      break;
    case "move":
      say((at + 1) + "/8 · " + STAGES[at][0] + " …");
      if (Math.abs(x - target) < 0.05) { x = target; press[at].want = D.PRESS; enter("press"); }
      break;
    case "press":
      if (clock > 0.45 && press[at].want) { press[at].want = 0; done = at + 1; }
      say((at + 1) + "/8 · " + STAGES[at][0] + " · " + STAGES[at][1]);
      if (clock > (at === 7 ? 0.9 : 1.15)) {
        if (at < 7) { at++; target = XS[at]; enter("move"); }
        else { enter("live"); pings = 0; }
      }
      break;
    case "live":
      if (clock > 1.6) { pings++; clock = 0; press[7].want = D.PRESS * 0.7; setTimeout(() => press[7].want = 0, 260); }
      say("Running · health check " + pings + " · 200 OK");
      if (pings >= 3 && clock > 1.2) enter("out");
      break;
    case "out":
      alpha = ease(alpha, 0, 0.3);
      say("live at <project>-<you>-duckops.raycode.tech");
      if (clock > 1.6) { alpha = 0; x = target = D.START; done = 0; at = -1; enter("in"); }
      break;
  }
  const before = x;
  x = ease(x, target, 0.3);
  if (Math.abs(x - target) < 0.04) x = target;
  travel += x - before;
  for (const p of press) {
    if (calm) { p.at = p.want; p.rate = 0; continue; }
    for (let s = 0; s < 4; s++) { p.rate += ((p.want - p.at) * 300 - p.rate * 20) * dt / 4; p.at += p.rate * dt / 4; }
    if (p.at > D.PRESS) { p.at = D.PRESS; p.rate = -p.rate * 0.2; }
  }
  draw();
  frame = visible ? requestAnimationFrame(tick) : 0;
}
const run = () => { if (!frame && visible) { last = 0; frame = requestAnimationFrame(tick); } };
new IntersectionObserver((entries) => { visible = entries[entries.length - 1].isIntersecting; if (visible) run(); }, { rootMargin: "120px 0px" }).observe(stage);
stage.setAttribute("aria-valuetext", "A project moving through the eight provisioning stages, on a loop");
draw();

}
function start(){document.querySelectorAll('[data-figure="duckops-line"]').forEach(function(root){if(!root.dataset.live){root.dataset.live="1";mount(root);}});}
window.isoMount=window.isoMount||{};window.isoMount["duckops-line"]=start;
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start);else start();
})();
