// Runs the real page scripts in jsdom with a fake Supabase client and checks every state.
// Needs jsdom: npm install --no-save jsdom   then   node tests/check-pages.js
const fs = require("fs");
const assert = require("assert");
const { JSDOM, VirtualConsole } = require("jsdom");

const ROOT = require("path").join(__dirname, "..");
const DESKTOP_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120";
const PHONE_UA = "Mozilla/5.0 (Linux; Android 14; Pixel 8) Chrome/120 Mobile";
const TOKENS = "#access_token=AAA&refresh_token=RRR&expires_in=3600&token_type=bearer&type=recovery";

function createStubClient({ sessionError = null, updateError = null } = {}) {
  const calls = { setSession: [], updateUser: [], signOut: [] };
  return {
    calls,
    client: {
      auth: {
        setSession: async (args) => (calls.setSession.push(args), { error: sessionError }),
        updateUser: async (args) => (calls.updateUser.push(args), { error: updateError }),
        signOut: async (args) => (calls.signOut.push(args), { error: null }),
      },
    },
  };
}

function load(page, files, { hash = "", ua = DESKTOP_UA, stub = createStubClient() } = {}) {
  const html = fs.readFileSync(`${ROOT}/${page}.html`, "utf8").replace(/<script[^>]*><\/script>/g, "");
  const navigations = [];
  const virtualConsole = new VirtualConsole();
  virtualConsole.on("jsdomError", (error) => {
    if (/navigation/i.test(error.message)) navigations.push(error.message);
  });
  const dom = new JSDOM(html, {
    url: `https://orquidealabs.github.io/ungoon-web/${page}.html${hash}`,
    runScripts: "outside-only",
    userAgent: ua,
    virtualConsole,
  });
  const w = dom.window;
  Object.defineProperty(w.navigator, "userAgent", { value: ua, configurable: true });
  w.supabase = { createClient: () => stub.client };
  w.UNGOON_CONFIG = { supabaseUrl: "https://x.supabase.co", supabaseKey: "sb_publishable_test" };
  files.forEach((file, index) => {
    w.eval(fs.readFileSync(`${ROOT}/${file}`, "utf8"));
    // Right after app-link.js runs, replace the real jump to the app with a recorder.
    if (index === 0) w.UngoonLink.openApp = (path) => navigations.push("ungoon://" + path);
  });
  return { w, doc: w.document, stub, navigations };
}
const visible = (doc, id) => !doc.getElementById(id).hidden;
const tick = () => new Promise((resolve) => setTimeout(resolve, 20));
const RESET = ["app-link.js", "reset-password.js"];
const VERIFIED = ["app-link.js", "verified.js"];

async function main() {
  let passed = 0;
  const check = async (name, fn) => {
    await fn();
    passed += 1;
    console.log("ok -", name);
  };

  await check("reset: an error link shows the expired message", async () => {
    const { doc } = load("reset-password", RESET, { hash: "#error=access_denied&error_code=otp_expired" });
    assert(visible(doc, "invalid-section") && !visible(doc, "form-section"));
  });

  await check("reset: opening without a link shows the expired message", async () => {
    const { doc } = load("reset-password", RESET);
    assert(visible(doc, "invalid-section"));
  });

  await check("reset: a valid link on a computer shows the form, the app button, and clears the address bar", async () => {
    const { doc, w, navigations } = load("reset-password", RESET, { hash: TOKENS });
    assert(visible(doc, "form-section") && !visible(doc, "invalid-section"));
    assert.strictEqual(doc.getElementById("open-app").href, `ungoon://reset-password${TOKENS}`);
    assert(!doc.getElementById("open-app").hidden);
    assert.strictEqual(w.location.hash, "");
    assert.strictEqual(navigations.length, 0, "a computer must not try to open the app");
  });

  await check("reset: on a phone it tries to open the app, and the form is still there", async () => {
    const { doc, navigations } = load("reset-password", RESET, { hash: TOKENS, ua: PHONE_UA });
    assert(navigations.length >= 1, "expected an attempt to open ungoon://");
    assert(visible(doc, "form-section"));
  });

  await check("reset: a weak password is refused before calling the server", async () => {
    const { doc, stub } = load("reset-password", RESET, { hash: TOKENS });
    doc.getElementById("password").value = "short1";
    doc.getElementById("form").dispatchEvent(new doc.defaultView.Event("submit", { cancelable: true }));
    await tick();
    assert(/at least 8 characters/.test(doc.getElementById("error").textContent));
    assert.strictEqual(stub.calls.setSession.length, 0);
    doc.getElementById("password").value = "onlyletters";
    doc.getElementById("form").dispatchEvent(new doc.defaultView.Event("submit", { cancelable: true }));
    await tick();
    assert(/letters and numbers/.test(doc.getElementById("error").textContent));
  });

  await check("reset: a good password uses the tokens, updates the password and signs out locally", async () => {
    const { doc, stub } = load("reset-password", RESET, { hash: TOKENS });
    doc.getElementById("password").value = "calm1234";
    doc.getElementById("form").dispatchEvent(new doc.defaultView.Event("submit", { cancelable: true }));
    await tick();
    assert.strictEqual(JSON.stringify(stub.calls.setSession), JSON.stringify([{ access_token: "AAA", refresh_token: "RRR" }]));
    assert.strictEqual(JSON.stringify(stub.calls.updateUser), JSON.stringify([{ password: "calm1234" }]));
    assert.strictEqual(JSON.stringify(stub.calls.signOut), JSON.stringify([{ scope: "local" }]));
    assert(visible(doc, "done-section") && !visible(doc, "form-section"));
  });

  await check("reset: a refused session (used or old link) shows the expired message", async () => {
    const stub = createStubClient({ sessionError: new Error("invalid") });
    const { doc } = load("reset-password", RESET, { hash: TOKENS, stub });
    doc.getElementById("password").value = "calm1234";
    doc.getElementById("form").dispatchEvent(new doc.defaultView.Event("submit", { cancelable: true }));
    await tick();
    assert(visible(doc, "invalid-section") && !visible(doc, "form-section"));
    assert.strictEqual(stub.calls.updateUser.length, 0);
  });

  await check("reset: a server error on the update is shown and the form stays", async () => {
    const stub = createStubClient({ updateError: new Error("New password should be different") });
    const { doc } = load("reset-password", RESET, { hash: TOKENS, stub });
    doc.getElementById("password").value = "calm1234";
    doc.getElementById("form").dispatchEvent(new doc.defaultView.Event("submit", { cancelable: true }));
    await tick();
    assert(/should be different/.test(doc.getElementById("error").textContent));
    assert(visible(doc, "form-section"));
    assert(!doc.getElementById("save").disabled);
  });

  await check("verified: shows the app button with the answer, and opens the app on a phone", async () => {
    const hash = "#access_token=AAA&refresh_token=RRR&type=signup";
    const desktop = load("verified", VERIFIED, { hash });
    assert(visible(desktop.doc, "ok-section"));
    assert.strictEqual(desktop.doc.getElementById("open-app").href, `ungoon://${hash}`);
    assert.strictEqual(desktop.navigations.length, 0);
    const phone = load("verified", VERIFIED, { hash, ua: PHONE_UA });
    assert(phone.navigations.length >= 1);
  });

  await check("verified: an error link shows the expired message", async () => {
    const { doc } = load("verified", VERIFIED, { hash: "#error=access_denied&error_code=otp_expired" });
    assert(visible(doc, "invalid-section") && !visible(doc, "ok-section"));
  });

  console.log(`\n${passed} checks passed`);
}

main().catch((error) => {
  console.error("FAILED:", error.message);
  process.exit(1);
});
