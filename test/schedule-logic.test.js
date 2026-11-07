"use strict";

var assert = require("assert");
var fs = require("fs");
var path = require("path");
var vm = require("vm");

var root = path.join(__dirname, "..");
var logic = require(path.join(root, "schedule-logic.js"));

function loadVar(file, name) {
  var code = fs.readFileSync(path.join(root, file), "utf8");
  var prefix = "var " + name + " = ";
  if (code.indexOf(prefix) !== 0) throw new Error("missing " + name + " in " + file);
  var body = code.slice(prefix.length).trim();
  if (body.charAt(body.length - 1) === ";") body = body.slice(0, -1);
  return JSON.parse(body);
}

function extractConstArray(src, name) {
  var token = "const " + name + " = ";
  var start = src.indexOf(token);
  if (start < 0) throw new Error("missing " + name);
  start += token.length;
  if (src[start] !== "[") throw new Error(name + " is not an array");
  var i = start;
  var depth = 0;
  var quote = null;
  for (; i < src.length; i++) {
    var ch = src[i];
    if (quote) {
      if (ch === "\\") { i++; continue; }
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") { quote = ch; continue; }
    if (ch === "[") depth++;
    else if (ch === "]") {
      depth--;
      if (depth === 0) {
        var literal = src.slice(start, i + 1);
        var BOTH = ["weekday", "weekend"];
        return vm.runInNewContext("(" + literal + ")", { BOTH: BOTH });
      }
    }
  }
  throw new Error("unterminated " + name);
}

var seasonal = loadVar("data/seasonal-trains.js", "SEASONAL_DATA");
var seasonalJson = JSON.parse(fs.readFileSync(path.join(root, "data/seasonal-trains.json"), "utf8"));
var disruption = loadVar("data/disruption-notices.js", "DISRUPTION_DATA");
var html = fs.readFileSync(path.join(root, "index.html"), "utf8");
var arrivals = extractConstArray(html, "arrivals");
var departures = extractConstArray(html, "departures");
var jrArrivals = extractConstArray(html, "jrArrivals");
var jrDepartures = extractConstArray(html, "jrDepartures");

var fixedNow = new Date("2026-11-07T06:00:00Z");
var trains = {};
seasonal.trains.forEach(function (t) { trains[t.id] = t; });

function planned(id, ymd) {
  return logic.evaluateTrain(trains[id], ymd).planned_status;
}

function arrivalRows(ymd) {
  return logic.buildJrDirection(jrArrivals, seasonal, ymd, "arrival");
}
function departureRows(ymd) {
  return logic.buildJrDirection(jrDepartures, seasonal, ymd, "departure");
}
function activeIds(rows) {
  return rows.filter(logic.isActiveJrRow).map(function (r) { return r.seasonal_id || r.route; });
}

assert.deepStrictEqual(seasonal, seasonalJson, "seasonal js and json drifted");

assert.strictEqual(logic.jstYmd(new Date("2026-11-07T14:59:30Z")), "2026-11-07");
assert.strictEqual(logic.jstYmd(new Date("2026-11-07T15:00:00Z")), "2026-11-08");
assert.strictEqual(logic.jstYmd(new Date("2026-11-07T15:30:00+09:00")), "2026-11-07");
assert.strictEqual(logic.formatJaDate("2026-11-07"), "2026年11月7日（土）");
assert.strictEqual(logic.busDayForDate("2026-11-07"), "weekend");
assert.strictEqual(logic.busDayForDate("2026-11-06"), "weekday");
assert.strictEqual(logic.busDayForDate("2026-11-08"), "weekend");
assert.strictEqual(logic.busDayForDate("2026-08-13"), "weekend");
assert.strictEqual(logic.busDayForDate("2026-12-29"), "weekend");
assert.strictEqual(logic.busDayForDate("2027-01-03"), "weekend");
assert.strictEqual(logic.busDayForDate("2027-01-04"), "weekday");
assert.strictEqual(logic.busDayForDate("2026-11-03"), "weekday");

["mori1", "mori2", "mori3", "mori4", "mori5", "mori6", "aru_am", "aru_pm"].forEach(function (id) {
  assert.strictEqual(planned(id, "2026-11-07"), "scheduled", id + " on Nov 7");
});
assert.strictEqual(planned("yufu73", "2026-11-07"), "not_scheduled");
assert.strictEqual(planned("yufu74", "2026-11-07"), "not_scheduled");
assert.strictEqual(planned("kanpachi", "2026-11-07"), "unconfirmed");
assert.strictEqual(planned("ichiroku", "2026-11-07"), "unconfirmed");
assert.strictEqual(planned("kanpachi", "2026-11-09"), "unconfirmed");
assert.strictEqual(planned("ichiroku", "2026-11-08"), "unconfirmed");
assert.strictEqual(trains.kanpachi.operation.reference_weekday_pattern_must_not_generate_dates, true);
assert.deepStrictEqual(trains.kanpachi.operation.scheduled_dates, []);

assert.strictEqual(logic.evaluateTrain(trains.aru_am, "2026-11-07").arrival_display, "14:08頃");
assert.strictEqual(logic.evaluateTrain(trains.aru_pm, "2026-11-07").departure_display, "15:00頃");
assert.strictEqual(logic.evaluateTrain(trains.aru_am, "2026-11-08").planned_status, "scheduled");
assert.strictEqual(logic.evaluateTrain(trains.aru_pm, "2026-11-08").planned_status, "unconfirmed");
assert.strictEqual(logic.evaluateTrain(trains.aru_am, "2026-11-03").planned_status, "unconfirmed");
assert.strictEqual(logic.evaluateTrain(trains.aru_pm, "2026-11-03").planned_status, "unconfirmed");
assert.ok(logic.evaluateTrain(trains.aru_am, "2026-11-03").summary.indexOf("運休の証明ではなく") !== -1);

["2026-11-14", "2026-11-15", "2026-11-16", "2026-11-19", "2026-11-20", "2026-11-21", "2026-11-22", "2026-11-23"].forEach(function (ymd) {
  assert.strictEqual(planned("mori3", ymd), "scheduled", ymd);
  assert.strictEqual(planned("yufu73", ymd), "not_scheduled", ymd);
});

["2026-11-30", "2026-12-01", "2026-12-02", "2026-12-03", "2026-12-04", "2027-01-13", "2027-01-14", "2027-01-15", "2027-01-18", "2027-01-19", "2027-01-20", "2027-01-21"].forEach(function (ymd) {
  assert.strictEqual(planned("yufu73", ymd), "scheduled", ymd);
  assert.strictEqual(planned("yufu74", ymd), "scheduled", ymd);
  assert.strictEqual(planned("mori3", ymd), "not_scheduled", ymd);
  assert.strictEqual(planned("mori4", ymd), "not_scheduled", ymd);
  assert.strictEqual(planned("mori1", ymd), "scheduled", ymd);
  assert.strictEqual(planned("mori6", ymd), "scheduled", ymd);
});

["2026-12-05", "2027-01-16", "2027-01-17", "2027-02-28"].forEach(function (ymd) {
  assert.strictEqual(planned("mori3", ymd), "scheduled", ymd);
  assert.strictEqual(planned("mori4", ymd), "scheduled", ymd);
  assert.strictEqual(planned("yufu73", ymd), "not_scheduled", ymd);
  assert.strictEqual(planned("yufu74", ymd), "not_scheduled", ymd);
});

assert.strictEqual(planned("mori1", "2027-03-01"), "unconfirmed");
assert.strictEqual(planned("aru_am", "2027-03-01"), "unconfirmed");
assert.strictEqual(planned("mori3", "2027-03-01"), "unconfirmed");
assert.ok(logic.calendarBanner("2027-03-01").indexOf("未確認") !== -1);

logic.eachDate("2026-10-01", "2027-02-28", function (ymd) {
  var a = planned("mori3", ymd) === "scheduled";
  var b = planned("yufu73", ymd) === "scheduled";
  assert.strictEqual(a !== b, true, "mori3/yufu73 overlap " + ymd);
  var c = planned("mori4", ymd) === "scheduled";
  var d = planned("yufu74", ymd) === "scheduled";
  assert.strictEqual(c !== d, true, "mori4/yufu74 overlap " + ymd);
});

var premium = logic.evaluateTrain(trains.sevenstars_premium_b, "2026-11-07");
assert.strictEqual(premium.planned_status, "unconfirmed");
assert.strictEqual(premium.arrival_display, "時刻未確認");
assert.strictEqual(premium.departure_display, "時刻未確認");
assert.strictEqual(trains.sevenstars_premium_b.arrival, null);
assert.ok(premium.summary.indexOf("14:58") === -1);
assert.strictEqual(premium.views.arrival, true);
assert.strictEqual(premium.views.departure, true);

var yufuinCourse = logic.evaluateTrain(trains.sevenstars_yufuin, "2026-12-15");
assert.strictEqual(yufuinCourse.planned_status, "unconfirmed");
assert.strictEqual(yufuinCourse.arrival_display, "時刻未確認");
assert.strictEqual(yufuinCourse.departure_display, "時刻未確認");
assert.ok(yufuinCourse.summary.indexOf("ツアー出発日") !== -1);
assert.ok(yufuinCourse.summary.indexOf("14:58") === -1);
assert.ok(trains.sevenstars_yufuin.operation.tour_departure_dates.indexOf("2026-12-15") !== -1);

assert.strictEqual(planned("sevenstars_qualita_1128", "2026-11-28"), "scheduled");
assert.strictEqual(planned("sevenstars_qualita_1128", "2026-11-27"), "not_scheduled");
assert.strictEqual(logic.evaluateTrain(trains.sevenstars_qualita_1128, "2026-11-28").arrival_display, "14:58頃");
assert.strictEqual(logic.evaluateTrain(trains.sevenstars_qualita_1128, "2026-11-28").departure_display, "18:35頃");

var kan = logic.evaluateTrain(trains.kanpachi, "2026-11-07");
assert.strictEqual(kan.arrival_display, "15:41");
assert.strictEqual(kan.views.arrival, true);
assert.strictEqual(kan.views.departure, false);
assert.strictEqual(kan.counts_as_active, false);
var ichi = logic.evaluateTrain(trains.ichiroku, "2026-11-07");
assert.strictEqual(ichi.departure_display, "12:27");
assert.strictEqual(ichi.views.departure, true);
assert.strictEqual(ichi.views.arrival, false);

var nov7arr = arrivalRows("2026-11-07");
var nov7dep = departureRows("2026-11-07");
function findRoute(rows, needle) {
  return rows.filter(function (r) { return r.route.indexOf(needle) !== -1; });
}
assert.strictEqual(findRoute(nov7arr, "或る列車 午前便").length, 1);
assert.strictEqual(findRoute(nov7arr, "或る列車 午前便")[0].time, "14:08頃");
assert.strictEqual(findRoute(nov7arr, "或る列車 午前便")[0].planned_status, "scheduled");
assert.strictEqual(findRoute(nov7dep, "或る列車 午後便").length, 1);
assert.strictEqual(findRoute(nov7dep, "或る列車 午後便")[0].time, "15:00頃");
assert.strictEqual(findRoute(nov7arr, "ゆふいんの森3号").length, 1);
assert.strictEqual(findRoute(nov7arr, "ゆふいんの森3号")[0].time, "12:27");
assert.strictEqual(findRoute(nov7arr, "ゆふ73号").filter(logic.isActiveJrRow).length, 0);
assert.strictEqual(findRoute(nov7arr, "かんぱち")[0].planned_status, "unconfirmed");
assert.strictEqual(findRoute(nov7arr, "かんぱち")[0].time, "15:41");
assert.strictEqual(findRoute(nov7arr, "いちろく").length, 0);
assert.strictEqual(findRoute(nov7dep, "いちろく")[0].time, "12:27");
assert.strictEqual(findRoute(nov7dep, "いちろく")[0].planned_status, "unconfirmed");
assert.ok(findRoute(nov7arr, "プレミアム").length >= 1);
assert.strictEqual(findRoute(nov7arr, "プレミアム")[0].time, "時刻未確認");
assert.ok(findRoute(nov7dep, "プレミアム").length >= 1);
assert.strictEqual(findRoute(nov7dep, "由布院コース")[0].time, "時刻未確認");
assert.strictEqual(findRoute(nov7arr, "QUALITA")[0].planned_status, "not_scheduled");
assert.ok(activeIds(nov7arr).indexOf("sevenstars_qualita_1128") === -1);
assert.ok(nov7arr.some(function (r) { return r.time === "11:31" && r.route.indexOf("ゆふいんの森1号") !== -1; }));

var unknownIndex = nov7arr.findIndex(function (r) { return r.time === "時刻未確認"; });
var lastTimed = -1;
nov7arr.forEach(function (r, i) { if (logic.timeSortKey(r.time) < 24 * 60) lastTimed = i; });
assert.ok(unknownIndex > lastTimed);

var nov30 = arrivalRows("2026-11-30");
var row73 = nov30.filter(function (r) { return r.time === "12:27"; })[0];
assert.ok(row73.route.indexOf("ゆふ73号") !== -1);
assert.strictEqual(row73.planned_status, "scheduled");
assert.strictEqual(nov30.filter(function (r) { return r.time === "12:27" && logic.isActiveJrRow(r); }).length, 1);
assert.strictEqual(findRoute(nov30, "ゆふいんの森3号").filter(logic.isActiveJrRow).length, 0);

var dec5 = arrivalRows("2026-12-05");
assert.ok(dec5.some(function (r) { return r.time === "12:27" && r.route.indexOf("ゆふいんの森3号") !== -1 && r.planned_status === "scheduled"; }));
var mar1 = arrivalRows("2027-03-01");
var marMori = mar1.filter(function (r) { return r.time === "12:27"; })[0];
assert.ok(marMori.route.indexOf("ゆふいんの森3号") !== -1);
assert.strictEqual(marMori.planned_status, "unconfirmed");
assert.strictEqual(logic.isActiveJrRow(marMori), false);

var nov28 = arrivalRows("2026-11-28");
var nov27 = arrivalRows("2026-11-27");
assert.strictEqual(findRoute(nov28, "QUALITA")[0].planned_status, "scheduled");
assert.strictEqual(findRoute(nov27, "QUALITA")[0].planned_status, "not_scheduled");
assert.strictEqual(logic.isActiveJrRow(findRoute(nov27, "QUALITA")[0]), false);

var cardDec15 = logic.seasonalCardRows(seasonal, "2026-12-15", "arrival");
var course = cardDec15.filter(function (r) { return r.id === "sevenstars_yufuin"; })[0];
assert.ok(course);
assert.strictEqual(course.clock, "時刻未確認");
assert.ok(course.summary.indexOf("14:58") === -1);

var yufurin = arrivals.filter(function (r) { return r.route.indexOf("ゆふりん") !== -1; });
assert.ok(yufurin.length >= 1);
assert.ok(arrivals.some(function (r) { return r.time === "8:48" && r.route.indexOf("ゆふりん") !== -1; }));
assert.ok(jrArrivals.some(function (r) { return r.time === "11:31"; }));
var before = logic.busRowStatus(yufurin[0], "2026-10-16");
var after = logic.busRowStatus(yufurin[0], "2026-10-17");
assert.strictEqual(before.active, true);
assert.strictEqual(after.active, false);
assert.strictEqual(after.badge, "運休");
var weekend = logic.partitionBus(arrivals, "weekend", "all", "2026-11-07");
var weekday = logic.partitionBus(arrivals, "weekday", "all", "2026-11-07");
assert.ok(weekend.inactive.some(function (x) { return x.row.time === "8:48"; }));
assert.strictEqual(weekend.active.some(function (x) { return x.row.route.indexOf("ゆふりん") !== -1; }), false);
assert.strictEqual(weekday.inactive.filter(function (x) { return x.row.route.indexOf("ゆふりん") !== -1; }).length, 1);
var htmlRow = logic.busRowHtml(yufurin[0], after);
assert.ok(htmlRow.indexOf("8:48") !== -1 || htmlRow.indexOf(yufurin[0].time) !== -1);
assert.ok(htmlRow.indexOf("観光快速ゆふりん") !== -1);
assert.ok(htmlRow.indexOf("運休") !== -1);
assert.ok(htmlRow.indexOf("color:#fff") === -1);
assert.ok(htmlRow.indexOf("color: #fff") === -1);

var yunokaze = arrivals.filter(function (r) { return r.route.indexOf("ゆのかぜ") !== -1; })[0];
assert.strictEqual(logic.busRowStatus(yunokaze, "2026-12-03").badge, "運休");
assert.strictEqual(logic.busRowStatus(yunokaze, "2026-12-03").active, false);
assert.strictEqual(logic.busRowStatus(yunokaze, "2026-11-07").active, true);
assert.strictEqual(logic.busRowStatus(yunokaze, "2026-12-14").active, false);

var fukuoka = logic.partitionBus(arrivals, "weekend", "fukuoka", "2026-11-07");
assert.strictEqual(fukuoka.matched.some(function (r) { return r.route.indexOf("ゆふりん") !== -1; }), false);
assert.ok(fukuoka.active.length > 0);

var jrFiltered = logic.filterJrRows(nov7arr, "weekday", "hita");
assert.ok(jrFiltered.some(function (r) { return r.route.indexOf("或る列車 午前便") !== -1; }));
var jrOita = logic.filterJrRows(nov7arr, "weekend", "oita");
assert.strictEqual(jrOita.some(function (r) { return r.route.indexOf("或る列車") !== -1; }), false);
var jrSame = logic.filterJrRows(nov7arr, "weekday", "all");
assert.strictEqual(jrSame.length, logic.filterJrRows(nov7arr, "weekend", "all").length);

assert.deepStrictEqual(logic.panelsFor("bus", "arr")["panel-bus"], true);
assert.deepStrictEqual(logic.panelsFor("bus", "arr")["panel-jr"], false);
assert.deepStrictEqual(logic.panelsFor("jr", "dep")["panel-jr-dep"], true);
assert.deepStrictEqual(logic.panelsFor("jr", "dep")["panel-bus"], false);
assert.deepStrictEqual(logic.initialViewFromHash("#jr-dep-limited"), { mode: "jr", dir: "dep" });
assert.deepStrictEqual(logic.initialViewFromHash("#bus-dep-yufurin"), { mode: "bus", dir: "dep" });
assert.deepStrictEqual(logic.initialViewFromHash("#jr-limited"), { mode: "jr", dir: "arr" });

logic.ROUTE_CONTRAST.forEach(function (pair) {
  var ratio = logic.contrastRatio(pair.fg, pair.bg);
  assert.ok(ratio >= 4.5, pair.name + " contrast " + ratio);
});

var fresh = logic.renderDisruption(disruption, "2026-11-07", fixedNow);
assert.ok(fresh.indexOf("観光快速ゆふりん") !== -1);
assert.ok(fresh.indexOf("全便運休") !== -1);
assert.ok(fresh.indexOf("https://kamenoibus.com/archive/3724.html") !== -1);
assert.ok(fresh.indexOf("ゆのかぜ") !== -1);
assert.ok(fresh.indexOf("12月3日") !== -1);
assert.ok(fresh.indexOf("https://kamenoibus.com/archive/3728.html") !== -1);
assert.ok(fresh.indexOf("2026-11-07 07:59–08:02 JST") !== -1);
assert.ok(fresh.indexOf("リアルタイム") !== -1 || fresh.indexOf("ページを開いた時刻ではない") !== -1);
assert.ok(fresh.indexOf("九州のりものinfo") !== -1);
assert.ok(fresh.indexOf("平常運転") === -1);
assert.ok(fresh.indexOf("すべて通常") === -1);
assert.ok(fresh.indexOf("最新情報を確認できません") === -1);
var onInspection = logic.renderDisruption(disruption, "2026-12-03", fixedNow);
assert.ok(onInspection.indexOf("表示日がこの運休日です") !== -1);
var staleNow = new Date("2026-11-08T06:00:00+09:00");
var staleHtml = logic.renderDisruption(disruption, "2026-11-08", staleNow);
assert.ok(staleHtml.indexOf("最新情報を確認できません。前回確認時の参考情報です。公式サイトでご確認ください。") !== -1);
assert.ok(staleHtml.indexOf("観光快速ゆふりん") !== -1);
assert.strictEqual(disruption.checked_at, "2026-11-07T08:02:39+09:00");
assert.strictEqual(disruption.checked_window_jst, "2026-11-07 07:59–08:02 JST");

var card = logic.seasonalCardHtml(seasonal, "2026-11-07", "arrival", fixedNow);
assert.ok(card.indexOf("或る列車 午前便") !== -1);
assert.ok(card.indexOf("運転予定") !== -1);
assert.ok(card.indexOf("運行状況未確認") !== -1);
assert.ok(card.indexOf("平常運転") === -1);
assert.ok(card.indexOf("2026-11-08 06:50 JST") !== -1);
assert.strictEqual(seasonal.checked_at, "2026-11-08T06:50:00+09:00");
assert.strictEqual(seasonal.research_date, "2026-11-08");
var todayById = {};
seasonal.today.forEach(function (row) { todayById[row.train_id] = row; });
["mori1", "mori2", "mori3", "mori4", "mori5", "mori6", "aru_am"].forEach(function (id) {
  assert.strictEqual(todayById[id].planned_status, "scheduled", "today " + id);
  assert.strictEqual(todayById[id].planned_status, planned(id, "2026-11-08"), "today matches calendar " + id);
});
["yufu73", "yufu74", "sevenstars_qualita_1128"].forEach(function (id) {
  assert.strictEqual(todayById[id].planned_status, "not_scheduled", "today " + id);
  assert.strictEqual(todayById[id].planned_status, planned(id, "2026-11-08"), "today matches calendar " + id);
});
["aru_pm", "kanpachi", "ichiroku", "sevenstars_yufuin", "sevenstars_waita", "sevenstars_premium_b"].forEach(function (id) {
  assert.strictEqual(todayById[id].planned_status, "unconfirmed", "today " + id);
  assert.strictEqual(todayById[id].planned_status, planned(id, "2026-11-08"), "today matches calendar " + id);
});
assert.ok(todayById.sevenstars_premium_b.note.indexOf("Nov8") !== -1);
assert.ok(todayById.sevenstars_premium_b.note.indexOf("unverified") !== -1);

assert.ok(html.indexOf('id="disruption-heading"') !== -1);
assert.ok(html.indexOf("data/seasonal-trains.js") !== -1);
assert.ok(html.indexOf("YufuinSchedule.buildJrDirection") !== -1);
assert.ok(html.indexOf("--c-yufurin: #b45309") !== -1);
assert.ok(html.indexOf('id="tab-bus"') !== -1);
assert.ok(html.indexOf('id="tab-jr"') !== -1);
assert.ok(html.indexOf('id="tab-arr"') !== -1);
assert.ok(html.indexOf('id="tab-dep"') !== -1);
assert.ok(html.indexOf("--ink: #1a1a1a") !== -1);
assert.ok(/tr\.rte-yufurin td[\s\S]{0,180}color:\s*var\(--ink\)/.test(html));
assert.ok(html.indexOf("color: #fff") !== -1);

var checked = disruption.checked_at;
logic.renderDisruption(disruption, "2026-11-07", new Date());
assert.strictEqual(disruption.checked_at, checked);

console.log("schedule-logic tests passed");
console.log("bus weekend active", weekend.active.length, "inactive", weekend.inactive.length);
console.log("jr nov7 arrivals", nov7arr.length, "active", nov7arr.filter(logic.isActiveJrRow).length);
