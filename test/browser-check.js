"use strict";

var http = require("http");
var fs = require("fs");
var path = require("path");
var { spawn } = require("child_process");

var root = path.join(__dirname, "..");
var port = 8765;

function contentType(file) {
  if (file.endsWith(".js")) return "text/javascript; charset=utf-8";
  if (file.endsWith(".json")) return "application/json; charset=utf-8";
  if (file.endsWith(".html")) return "text/html; charset=utf-8";
  return "application/octet-stream";
}

var server = http.createServer(function (req, res) {
  var url = req.url.split("?")[0];
  if (url === "/") url = "/index.html";
  var file = path.normalize(path.join(root, url));
  if (!file.startsWith(root)) {
    res.writeHead(403);
    res.end("no");
    return;
  }
  fs.readFile(file, function (err, buf) {
    if (err) {
      res.writeHead(404);
      res.end("missing");
      return;
    }
    res.writeHead(200, { "Content-Type": contentType(file) });
    res.end(buf);
  });
});

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

function cdp(ws, method, params, session) {
  var id = cdp.next = (cdp.next || 0) + 1;
  var msg = { id: id, method: method, params: params || {} };
  if (session) msg.sessionId = session;
  ws.send(JSON.stringify(msg));
  return new Promise(function (resolve, reject) {
    function onMessage(event) {
      var raw = typeof event.data === "string" ? event.data : event.data.toString();
      var data = JSON.parse(raw);
      if (data.id !== id) return;
      ws.removeEventListener("message", onMessage);
      if (data.error) reject(new Error(method + " " + JSON.stringify(data.error)));
      else resolve(data.result || {});
    }
    ws.addEventListener("message", onMessage);
  });
}

async function main() {
  await new Promise(function (resolve) { server.listen(port, "127.0.0.1", resolve); });
  var chrome = spawn("google-chrome", [
    "--headless=new",
    "--disable-gpu",
    "--no-sandbox",
    "--remote-debugging-port=9222",
    "--user-data-dir=/tmp/chrome-yufuin",
    "about:blank"
  ], { stdio: "ignore" });
  var browserWs;
  for (var i = 0; i < 40; i++) {
    try {
      var res = await fetch("http://127.0.0.1:9222/json/version");
      var info = await res.json();
      browserWs = info.webSocketDebuggerUrl;
      break;
    } catch (e) {
      await sleep(250);
    }
  }
  if (!browserWs) throw new Error("chrome did not start");
  var ws = new WebSocket(browserWs);
  await new Promise(function (resolve, reject) {
    ws.addEventListener("open", resolve);
    ws.addEventListener("error", reject);
  });
  var created = await cdp(ws, "Target.createTarget", { url: "about:blank" });
  var attached = await cdp(ws, "Target.attachToTarget", { targetId: created.targetId, flatten: true });
  var session = attached.sessionId;
  await cdp(ws, "Page.enable", {}, session);
  await cdp(ws, "Runtime.enable", {}, session);

  async function open(url) {
    await cdp(ws, "Page.navigate", { url: url }, session);
    await sleep(900);
    var expr = await cdp(ws, "Runtime.evaluate", {
      expression: "document.body ? document.body.innerText : ''",
      returnByValue: true
    }, session);
    return expr.result.value || "";
  }

  async function evalIn(expression) {
    var out = await cdp(ws, "Runtime.evaluate", {
      expression: expression,
      returnByValue: true
    }, session);
    if (out.exceptionDetails) throw new Error(JSON.stringify(out.exceptionDetails));
    return out.result.value;
  }

  var failures = [];
  function check(name, ok, detail) {
    if (!ok) failures.push(name + (detail ? ": " + detail : ""));
    else console.log("ok", name);
  }

  var todayText = await open("http://127.0.0.1:" + port + "/?date=2026-11-07");
  check("disruption heading", todayText.indexOf("由布院に関係する運休・遅延のお知らせ") !== -1);
  check("not realtime", todayText.indexOf("リアルタイムの運行情報ではありません") !== -1);
  check("yufurin suspension", todayText.indexOf("全便運休") !== -1);
  check("checked window", todayText.indexOf("2026-11-07 07:59–08:02 JST") !== -1);
  check("no normal claim", todayText.indexOf("平常運転") === -1);
  check("selected date", todayText.indexOf("表示日 2026年11月7日（土）") !== -1);
  var yufurinRow = await evalIn("document.querySelector('#chrono-body tr.rte-yufurin') && document.querySelector('#chrono-body tr.rte-yufurin').innerText");
  check("yufurin row kept", yufurinRow && yufurinRow.indexOf("運休") !== -1 && yufurinRow.indexOf("ゆふりん") !== -1, yufurinRow);
  var ink = await evalIn("(function(){var td=document.querySelector('#chrono-body tr.rte-yufurin td'); var s=getComputedStyle(td); return s.color+' '+s.backgroundColor;})()");
  check("yufurin text not white", ink && ink.indexOf("rgb(255, 255, 255)") !== 0, ink);

  await evalIn("document.getElementById('tab-jr').click()");
  await sleep(100);
  var jrText = await evalIn("document.getElementById('panel-jr').innerText");
  check("jr panel shown", (await evalIn("document.getElementById('panel-jr').hidden")) === false);
  check("aru both directions listed", jrText.indexOf("或る列車 午前便") !== -1 && jrText.indexOf("14:08頃") !== -1);
  check("mori3 today", jrText.indexOf("ゆふいんの森3号") !== -1 && jrText.indexOf("12:27") !== -1);
  check("kanpachi unknown", jrText.indexOf("かんぱち") !== -1 && jrText.indexOf("未確認") !== -1);
  check("premium unknown time", jrText.indexOf("プレミアム") !== -1 && jrText.indexOf("時刻未確認") !== -1);
  check("bus panel hidden on jr", (await evalIn("document.getElementById('panel-bus').hidden")) === true);

  await evalIn("document.getElementById('tab-dep').click()");
  await sleep(100);
  var depText = await evalIn("document.getElementById('panel-jr-dep').innerText");
  check("aru departure", depText.indexOf("或る列車 午後便") !== -1 && depText.indexOf("15:00頃") !== -1);
  check("ichiroku departure", depText.indexOf("いちろく") !== -1 && depText.indexOf("12:27") !== -1);
  check("disruption still visible", (await evalIn("document.getElementById('disruption-panel').innerText")).indexOf("ゆふりん") !== -1);

  await open("http://127.0.0.1:" + port + "/?date=2026-11-30#jr-limited");
  await evalIn("document.getElementById('tab-jr').click()");
  var sub = await evalIn("document.getElementById('panel-jr').innerText");
  check("nov30 yufu73", sub.indexOf("ゆふ73号") !== -1 && sub.indexOf("12:27") !== -1);
  check("nov30 mori3 inactive label", sub.indexOf("ゆふいんの森3号") !== -1 && sub.indexOf("運転設定なし") !== -1);

  await open("http://127.0.0.1:" + port + "/?date=2026-12-05#jr");
  await evalIn("document.getElementById('tab-jr').click()");
  var restored = await evalIn("[].slice.call(document.querySelectorAll('#jr-chrono-body tr')).filter(function(tr){return tr.innerText.indexOf('12:27')===0 || tr.cells[0].innerText.indexOf('12:27')===0;}).map(function(tr){return tr.cells[2].innerText;}).join('|')");
  check("dec5 mori restored", restored.indexOf("ゆふいんの森3号") !== -1 && restored.indexOf("ゆふ73号") === -1, restored);

  await open("http://127.0.0.1:" + port + "/?date=2026-11-28#jr");
  await evalIn("document.getElementById('tab-jr').click()");
  var charter = await evalIn("document.getElementById('panel-jr').innerText");
  check("nov28 charter", charter.indexOf("14:58頃") !== -1 && charter.indexOf("QUALITA") !== -1);

  await open("http://127.0.0.1:" + port + "/?date=2026-11-27#jr");
  await evalIn("document.getElementById('tab-jr').click()");
  var not27 = await evalIn("[].slice.call(document.querySelectorAll('#jr-chrono-body tr')).filter(function(tr){return tr.innerText.indexOf('QUALITA')!==-1;}).map(function(tr){return tr.innerText;}).join('\\n')");
  check("nov27 charter not active", not27.indexOf("運転設定なし") !== -1 && not27.indexOf("運転予定") === -1, not27);

  await open("http://127.0.0.1:" + port + "/?date=2026-12-15#jr");
  await evalIn("document.getElementById('tab-jr').click()");
  var dec15 = await evalIn("[].slice.call(document.querySelectorAll('#jr-seasonal-body tr')).filter(function(tr){return tr.innerText.indexOf('由布院コース')!==-1 && tr.innerText.indexOf('QUALITA')===-1;}).map(function(tr){return tr.innerText;}).join('\\n')");
  check("dec15 tour kept", dec15.indexOf("由布院コース") !== -1 && dec15.indexOf("時刻未確認") !== -1, dec15);
  check("dec15 no invented time", dec15.indexOf("14:58") === -1, dec15);

  await open("http://127.0.0.1:" + port + "/?date=2027-03-01#jr");
  await evalIn("document.getElementById('tab-jr').click()");
  var march = await evalIn("document.getElementById('panel-jr').innerText");
  check("march unknown", march.indexOf("未確認") !== -1 && march.indexOf("2027年3月1日以降") !== -1);

  await open("http://127.0.0.1:" + port + "/?date=2026-12-03");
  var dec3 = await evalIn("document.getElementById('disruption-panel').innerText");
  check("dec3 yunokaze", dec3.indexOf("表示日がこの運休日です") !== -1);
  var yuno = await evalIn("[].slice.call(document.querySelectorAll('#chrono-body tr')).filter(function(tr){return tr.innerText.indexOf('ゆのかぜ')!==-1;}).map(function(tr){return tr.innerText;}).join('\\n')");
  check("yunokaze suspended row", yuno.indexOf("運休") !== -1, yuno);

  await evalIn("document.querySelector('#group-seg button[data-value=\"fukuoka\"]').click()");
  await sleep(50);
  var fukuoka = await evalIn("document.getElementById('chrono-body').innerText");
  check("fukuoka filter drops yufurin", fukuoka.indexOf("ゆふりん") === -1 && fukuoka.indexOf("ゆふいん号") !== -1);

  fs.mkdirSync("/opt/cursor/artifacts", { recursive: true });
  await cdp(ws, "Emulation.setDeviceMetricsOverride", {
    width: 390, height: 844, deviceScaleFactor: 2, mobile: true
  }, session);
  await open("http://127.0.0.1:" + port + "/?date=2026-11-07#yufurin");
  await evalIn("document.getElementById('yufurin').scrollIntoView()");
  await sleep(200);
  var shot = await cdp(ws, "Page.captureScreenshot", { format: "png" }, session);
  fs.writeFileSync("/opt/cursor/artifacts/yufurin-mobile.png", Buffer.from(shot.data, "base64"));
  await cdp(ws, "Emulation.setDeviceMetricsOverride", {
    width: 1280, height: 900, deviceScaleFactor: 1, mobile: false
  }, session);
  await open("http://127.0.0.1:" + port + "/?date=2026-11-07#jr-seasonal");
  await evalIn("document.getElementById('tab-jr').click(); document.getElementById('jr-seasonal').scrollIntoView()");
  await sleep(300);
  var desk = await cdp(ws, "Page.captureScreenshot", { format: "png" }, session);
  fs.writeFileSync("/opt/cursor/artifacts/jr-seasonal-desktop.png", Buffer.from(desk.data, "base64"));

  chrome.kill();
  server.close();
  if (failures.length) {
    console.error("FAILED");
    failures.forEach(function (f) { console.error(f); });
    process.exit(1);
  }
  console.log("browser checks passed");
}

main().catch(function (err) {
  console.error(err);
  process.exit(1);
});
