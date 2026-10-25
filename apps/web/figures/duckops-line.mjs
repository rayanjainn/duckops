// Fig: DuckOps' provisioning pipeline as an eight-station transfer line.
// A crate (your project) indexes along a belt under eight tool heads, one per
// stage the provisioning service runs. Each head presses, its lamp turns green
// and a mark on the crate's lid fills in. The last head is the health probe:
// once the app is running it taps /health on a schedule.
import * as G from "./kit/lathe.mjs";
import { emit, k, tools } from "./common.mjs";

const WIDTH = 660;
const HEIGHT = 360;

export const STAGES = [
  ["Initializing", "project saved, job queued"],
  ["Scaffolding", "code rendered from templates"],
  ["Creating repo", "GitHub repo created and pushed"],
  ["Provisioning", "image built, namespace by Terraform"],
  ["Configuring", "Ansible deploys to Kubernetes"],
  ["Pipeline ready", "Jenkins job created"],
  ["Deploying", "first build running"],
  ["Running", "/health checked every 30 s"],
];
const XS = [-91, -65, -39, -13, 13, 39, 65, 91];
const START = -117;

const PLATE = { x: -148, y: -50, w: 296, d: 100, r: 9 };
const PLATE_H = 12;
const FOOT_H = 5;

const BELT_Y = 12;
const BELT_TOP = 12;
const FRAME_Y = 14;
const DRUM_X = 118;
const DRUM_R = 5.6;
const CRATE = 18;
const CRATE_H = 9;
const CRATE_TOP = BELT_TOP + CRATE_H;
const HEAD_Z = 30;
const HEAD_TOP = 38;
const BEAM_Z = 40;
const BEAM_TOP = 46;
const ROD_L = 12;
const ROD_REST = 25.5; // tip bottom at rest
const PRESS = ROD_REST - CRATE_TOP - 0.1;
const FRAME_X = 132;
const POST_Y = 24;

const P = k.fitProjection(
  [...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0), [-FRAME_X, -POST_Y, BEAM_TOP + 8], [FRAME_X, POST_Y, BEAM_TOP + 8]],
  WIDTH,
  HEIGHT,
  { pad: 16, azimuth: 62 },
);
const T = tools(P);
const { at, S, L, D } = T;

function base() {
  const out = [T.basePlate(PLATE, PLATE_H, FOOT_H, { footInset: 22 })];
  out.push(T.ruler({ x: -120, y: 38, w: 150, d: 6, r: 1 }, 0));
  out.push(T.labelPlate({ x: 60, y: 31, w: 46, d: 13, r: 1.2 }, 0));
  return out.join("");
}

function framePost(x, y) {
  return (
    S(k.cylinder(x, y, 5.4, 0, 2.6, P, 26), { tone: "lo" }) +
    S(k.cylinder(x, y, 3.4, 2.6, BEAM_Z - 2.6, P, 24), { tone: "mid", crease: "none" }) +
    L([16, 30].map((z) => k.sideArc(x, y, 3.4, z, P, 16)).join(""), { tone: "faint" })
  );
}

function conveyor() {
  const out = [];
  // Legs, back side first.
  const legs = [];
  for (const x of [-108, 0, 108]) for (const y of [-FRAME_Y, FRAME_Y - 4]) legs.push([x, y]);
  for (const [x, y] of T.byDepth(legs)) out.push(S(k.slabOf({ x: x - 3, y, w: 6, d: 4, r: 0.8 }, 0, BELT_TOP - 4, P, 3, 0.3), { tone: "lo" }));
  // Drums at both ends, turned along y.
  for (const x of [-DRUM_X, DRUM_X]) {
    const F = G.frameAlong([x, -BELT_Y, BELT_TOP - DRUM_R], [0, 1, 0]);
    out.push(S(G.solidOf([[0, DRUM_R], [2 * BELT_Y, DRUM_R]], F, P), { tone: "mid", crease: "none" }));
  }
  // Back side bar, belt, front side bar.
  out.push(S(k.slabOf({ x: -DRUM_X - 4, y: -FRAME_Y - 1, w: 2 * DRUM_X + 8, d: 3, r: 0.8 }, BELT_TOP - 6, 6, P, 3, 0.4), { tone: "mid" }));
  out.push(S(k.slabOf({ x: -DRUM_X, y: -BELT_Y, w: 2 * DRUM_X, d: 2 * BELT_Y, r: 0.6 }, BELT_TOP - 1, 1, P, 2), { tone: "lo", crease: "none" }));
  out.push(`<g data-part="belt"></g>`);
  out.push(S(k.slabOf({ x: -DRUM_X - 4, y: FRAME_Y - 2, w: 2 * DRUM_X + 8, d: 3, r: 0.8 }, BELT_TOP - 6, 6, P, 3, 0.4), { tone: "mid" }));
  out.push(D([-DRUM_X, -54, 0, 54, DRUM_X].map((x) => at([x, FRAME_Y - 0.5, BELT_TOP])), { size: 0.42 }));
  // Drive motor on the near side of the left drum.
  out.push(S(G.disc(0, 9, 4.4, G.frameAlong([-DRUM_X, FRAME_Y + 1, BELT_TOP - DRUM_R], [0, 1, 0]), P, { bevel: 0.3 }), { tone: "mid" }));
  out.push(L(G.ribsOf(G.frameAlong([-DRUM_X, FRAME_Y + 1, BELT_TOP - DRUM_R], [0, 1, 0]), 1.5, 7.5, 4.4, 14, P, { seams: true }), { tone: "lo" }));
  return out.join("");
}

// The crate, built at x = 0.
export function crateSvg() {
  const h = CRATE / 2;
  const plan = { x: -h, y: -h, w: CRATE, d: CRATE, r: 1.4 };
  const out = [T.halo(plan, BELT_TOP, 0.1, 3)];
  out.push(S(k.slabOf(plan, BELT_TOP, CRATE_H, P, 3, 0.6), { tone: "hi", crease: "lo", lit: true, inner: L(k.sideSeam(plan, BELT_TOP + 2.2, P, 3), { tone: "faint" }) }));
  out.push(L(k.planOutline(k.insetPlan(plan, 1.6), CRATE_TOP, P, 3), { tone: "lo" }));
  const marks = [];
  for (let i = 0; i < 8; i++) {
    const cx = -5.25 + (i % 4) * 3.5;
    const cy = i < 4 ? -2.4 : 2.4;
    marks.push(`<path class="fig-mark" data-mark="${i}" d="${k.ring(cx, cy, 1.1, CRATE_TOP, P, 14)}"/>`);
  }
  out.push(marks.join(""));
  return out.join("");
}

const TIPS = [
  (x) => k.cylinder(x, 0, 3.2, 0, 1.4, P, 22),
  (x) => k.slabOf({ x: x - 4, y: -4, w: 8, d: 8, r: 0.8 }, 0, 1.4, P, 2),
  (x) => k.slabOf({ x: x - 2.4, y: -5, w: 4.8, d: 10, r: 0.6 }, 0, 1.4, P, 2),
  (x) => k.cylinder(x, 0, 4.6, 0, 1.4, P, 26),
  (x) => k.slabOf({ x: x - 5, y: -1.6, w: 10, d: 3.2, r: 0.8 }, 0, 1.4, P, 2),
  (x) => k.cylinder(x, 0, 3.8, 0, 1.4, P, 24),
  (x) => k.slabOf({ x: x - 3.4, y: -3.4, w: 6.8, d: 6.8, r: 2 }, 0, 1.4, P, 3),
  (x) => k.cylinder(x, 0, 1.8, 0, 1.4, P, 16),
];

function head(i) {
  const x = XS[i];
  const out = [];
  // Rod and tool: one group moved by the press.
  const rod = S(k.cylinder(x, 0, 1.2, ROD_REST + 1.4, ROD_L - 1.4, P, 14), { tone: "mid", crease: "none" });
  const tipPaths = TIPS[i](x);
  const tip = `<g transform="${k.translateAlong(P, [0, 0, ROD_REST])}">${S(tipPaths, { tone: "hi" })}</g>`;
  out.push(`<g data-rod="${i}">${rod}${tip}</g>`);
  const block = { x: x - 5, y: -6, w: 10, d: 12, r: 1.2 };
  out.push(S(k.slabOf(block, HEAD_Z, HEAD_TOP - HEAD_Z, P, 3, 0.5), { tone: "mid", inner: L(k.sideSeam(block, HEAD_Z + 2.4, P, 3), { tone: "faint" }) }));
  out.push(S(k.cylinder(x, 0, 3, HEAD_TOP, BEAM_Z - HEAD_TOP, P, 18), { tone: "mid", crease: "none" }));
  out.push(D([at([x + 5, -3, HEAD_Z + 5]), at([x + 5, 3, HEAD_Z + 5])], { size: 0.4 }));
  return out.join("");
}

function beam() {
  const out = [];
  const plan = { x: -FRAME_X - 5, y: -6, w: 2 * FRAME_X + 10, d: 12, r: 2 };
  out.push(S(k.slabOf(plan, BEAM_Z, BEAM_TOP - BEAM_Z, P, 4, 0.8), { tone: "mid" }));
  out.push(L(k.planOutline(k.insetPlan(plan, 2), BEAM_TOP, P, 4), { tone: "faint" }));
  XS.forEach((x, i) => {
    out.push(S(k.cylinder(x, 0, 3.4, BEAM_TOP, 1.4, P, 22), { tone: "mid" }));
    out.push(`<path class="fig-lamp" data-lamp="${i}" d="${k.cylinder(x, 0, 2.5, BEAM_TOP + 1.4, 1.8, P, 20).fill}"/>`);
    out.push(L(k.ring(x, 0, 2.5, BEAM_TOP + 3.2, P, 20), { tone: "mid" }));
  });
  out.push(D([-FRAME_X, FRAME_X].map((x) => at([x, 0, BEAM_TOP])), { size: 0.5 }));
  return out.join("");
}

function crossbar(x) {
  return S(k.slabOf({ x: x - 3, y: -POST_Y - 3, w: 6, d: 2 * POST_Y + 6, r: 1.2 }, BEAM_Z - 6, 6, P, 3, 0.5), { tone: "mid" });
}

const slots = [];
for (let i = 0; i <= 8; i++) {
  slots.push(`<g data-slot="${i}"></g>`);
  if (i < 8) slots.push(head(i));
}

const svg = k.figureSvg({
  width: WIDTH,
  height: HEIGHT,
  label:
    "An eight-station transfer line. A crate standing for your project rides a belt under eight tool heads hung from a beam. At each station the head presses, its lamp on the beam turns green and one mark on the crate's lid fills in: initializing, scaffolding, creating the repo, provisioning, configuring, pipeline ready, deploying and running. The last head is a health probe that taps the crate on a schedule.",
  body: [
    base(),
    framePost(-FRAME_X, -POST_Y),
    framePost(FRAME_X, -POST_Y),
    conveyor(),
    ...slots,
    crossbar(-FRAME_X),
    crossbar(FRAME_X),
    beam(),
    framePost(-FRAME_X, POST_Y),
    framePost(FRAME_X, POST_Y),
  ],
});

const live = String.raw`
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
`;

emit({
  name: "duckops-line",
  title: "Provisioning line",
  svg,
  plate: {
    fig: "Fig 1",
    title: "From stack to live",
    hint: "Eight stations · one project",
    readout: "new project · stack picked",
    aria: 'role="img" aria-label="Transfer line showing a project moving through the eight provisioning stages"',
    keys: [
      { mark: "lit", label: "The crate: your project" },
      { mark: "raised", label: "Eight heads: one per stage, lamp turns green when done" },
    ],
    caption:
      "You pick a stack in the wizard. DuckOps scaffolds the code, creates the repo, builds and provisions, deploys with Ansible, wires Jenkins and starts health checks. Every stage reports live to the dashboard, just as each lamp lights here.",
  },
  live,
  data: { P, XS, STAGES, START, PRESS, CRATE, DRUM_X, BELT_Y, BELT_TOP, CRATE_SVG: crateSvg() },
  css: `
.fig-mark{fill:none;stroke:var(--anatomy-lo);stroke-width:var(--anatomy-weight);transition:fill .3s}
.fig-mark[data-on="1"]{fill:var(--fig-go,#46d39a);stroke:var(--fig-go,#46d39a)}
.fig-lamp{fill:var(--anatomy-shade-1);stroke:var(--anatomy-mid);stroke-width:var(--anatomy-weight);transition:fill .35s var(--anatomy-ease)}
.fig-lamp[data-state="active"]{fill:var(--fig-warn,#f5a524)}
.fig-lamp[data-state="done"]{fill:var(--fig-go,#46d39a)}
`,
});
