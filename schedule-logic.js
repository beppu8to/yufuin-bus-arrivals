(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.YufuinSchedule = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  var PLANNED_LABEL = {
    scheduled: "運転予定",
    not_scheduled: "運転設定なし",
    unconfirmed: "未確認"
  };
  var LIVE_LABEL = {
    unconfirmed: "運行状況未確認",
    delayed: "遅延",
    cancelled: "運休",
    partially_cancelled: "一部運休"
  };
  var DOW = ["日", "月", "火", "水", "木", "金", "土"];
  var REGULAR_SEASONAL = {
    "特急ゆふいんの森1号": "mori1",
    "特急ゆふいんの森2号": "mori2",
    "特急ゆふいんの森3号": "mori3",
    "特急ゆふいんの森4号": "mori4",
    "特急ゆふいんの森5号": "mori5",
    "特急ゆふいんの森6号": "mori6"
  };
  var REPLACEMENT_OF = { mori3: "yufu73", mori4: "yufu74" };
  var COVERED_BY_REGULAR = {
    mori1: 1, mori2: 1, mori3: 1, mori4: 1, mori5: 1, mori6: 1, yufu73: 1, yufu74: 1
  };

  var ROUTE_CONTRAST = [
    { name: "ink-on-36", fg: "#1a1a1a", bg: "#e7f5f0" },
    { name: "ink-on-yufurin", fg: "#1a1a1a", bg: "#fff1e0" },
    { name: "ink-on-odan", fg: "#1a1a1a", bg: "#fde8dc" },
    { name: "ink-on-yunokaze", fg: "#1a1a1a", bg: "#def4f8" },
    { name: "ink-on-yufuingo", fg: "#1a1a1a", bg: "#f1e9fb" },
    { name: "ink-on-liner", fg: "#1a1a1a", bg: "#e7edff" },
    { name: "ink-on-37", fg: "#1a1a1a", bg: "#eef6d6" },
    { name: "ink-on-limited", fg: "#1a1a1a", bg: "#f7f1e8" },
    { name: "ink-on-suspended", fg: "#1a1a1a", bg: "#fde8e8" },
    { name: "ink-on-unconfirmed", fg: "#1a1a1a", bg: "#fff6e0" },
    { name: "ink-on-off", fg: "#1a1a1a", bg: "#f3f1ee" },
    { name: "badge-36", fg: "#ffffff", bg: "#0f6b52" },
    { name: "badge-yufurin", fg: "#ffffff", bg: "#b45309" },
    { name: "badge-odan", fg: "#ffffff", bg: "#9a3412" },
    { name: "badge-yunokaze", fg: "#ffffff", bg: "#0e7490" },
    { name: "badge-yufuingo", fg: "#ffffff", bg: "#6d28d9" },
    { name: "badge-liner", fg: "#ffffff", bg: "#1d4ed8" },
    { name: "badge-37", fg: "#ffffff", bg: "#4d7c0f" },
    { name: "badge-limited", fg: "#ffffff", bg: "#8a6a3b" },
    { name: "badge-local", fg: "#ffffff", bg: "#3d5a4c" },
    { name: "badge-suspended", fg: "#ffffff", bg: "#7f1d1d" },
    { name: "badge-planned", fg: "#ffffff", bg: "#1e3a5f" },
    { name: "badge-unknown", fg: "#ffffff", bg: "#7a4a12" },
    { name: "badge-off", fg: "#ffffff", bg: "#3f3f46" },
    { name: "disruption-text", fg: "#3f1212", bg: "#fff5f5" },
    { name: "disruption-link", fg: "#0f4c3a", bg: "#fff5f5" }
  ];

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function pad(n) { return n < 10 ? "0" + n : String(n); }

  function jstYmd(date) {
    var fmt = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Tokyo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    });
    return fmt.format(date);
  }

  function weekdayIndex(ymd) {
    var p = ymd.split("-");
    return new Date(Date.UTC(Number(p[0]), Number(p[1]) - 1, Number(p[2]))).getUTCDay();
  }

  function formatJaDate(ymd) {
    return ymd.slice(0, 4) + "年" + Number(ymd.slice(5, 7)) + "月" + Number(ymd.slice(8, 10)) + "日（" + DOW[weekdayIndex(ymd)] + "）";
  }

  function addDays(ymd, n) {
    var p = ymd.split("-");
    var dt = new Date(Date.UTC(Number(p[0]), Number(p[1]) - 1, Number(p[2]) + n));
    return dt.getUTCFullYear() + "-" + pad(dt.getUTCMonth() + 1) + "-" + pad(dt.getUTCDate());
  }

  function busDayForDate(ymd) {
    var dow = weekdayIndex(ymd);
    var md = ymd.slice(5);
    if (dow === 0 || dow === 6) return "weekend";
    if (md >= "08-13" && md <= "08-15") return "weekend";
    if (md >= "12-29" || md <= "01-03") return "weekend";
    return "weekday";
  }

  function formatCheckedAt(iso) {
    if (!iso) return "確認時刻未記載";
    var m = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/.exec(iso);
    if (!m) return iso;
    return m[1] + " " + m[2] + " JST";
  }

  function isStale(checkedAt, now, staleAfterHours) {
    var checked = Date.parse(checkedAt);
    var current = now instanceof Date ? now.getTime() : Date.parse(now);
    if (!isFinite(checked) || !isFinite(current)) return true;
    var hours = Number(staleAfterHours);
    if (!isFinite(hours)) return true;
    return current - checked > hours * 3600 * 1000;
  }

  function routeKey(route) {
    route = route || "";
    if (route.indexOf("36") === 0) return "36";
    if (route.indexOf("ゆふりん") !== -1) return "yufurin";
    if (route.indexOf("横断") !== -1) return "odan";
    if (route.indexOf("ゆのかぜ") !== -1) return "yunokaze";
    if (route.indexOf("ゆふいん号") !== -1) return "yufuingo";
    if (route.indexOf("ライナー") !== -1) return "liner";
    if (route.indexOf("37") === 0) return "37";
    return "";
  }

  function busRowStatus(row, date) {
    var route = row.route || "";
    if (route.indexOf("ゆふりん") !== -1) {
      if (date >= "2026-10-17") {
        return {
          active: false,
          badge: "運休",
          className: "is-suspended",
          extra: "10月17日から当面、全便運休。時刻は運休前の参考で、運行本数に数えません。"
        };
      }
    }
    if (route.indexOf("ゆのかぜ") !== -1) {
      if (date === "2026-12-03") {
        return {
          active: false,
          badge: "運休",
          className: "is-suspended",
          extra: "12月3日は定期点検のため全便運休。"
        };
      }
      if (date < "2026-10-07" || date > "2026-12-13") {
        return {
          active: false,
          badge: "期間外",
          className: "is-inactive",
          extra: "掲載期間は2026年10月7日〜12月13日。期間の外は運行日にしません。"
        };
      }
    }
    if (route.indexOf("37") === 0) {
      if (date < "2026-04-04" || date > "2026-11-29") {
        return {
          active: false,
          badge: "期間外",
          className: "is-inactive",
          extra: "掲載期間は2026年4月4日〜11月29日の土日祝。"
        };
      }
    }
    if (row.periodFrom && row.periodTo && (date < row.periodFrom || date > row.periodTo)) {
      return {
        active: false,
        badge: "期間外",
        className: "is-inactive",
        extra: "この時刻の適用期間は" + row.periodFrom + "〜" + row.periodTo + "です。"
      };
    }
    return { active: true, badge: "", className: "", extra: "" };
  }

  function filterByDayGroup(rows, day, group) {
    return rows.filter(function (a) {
      if (!a.days || a.days.indexOf(day) === -1) return false;
      if (group !== "all" && a.group !== group) return false;
      return true;
    });
  }

  function partitionBus(rows, day, group, date) {
    var matched = filterByDayGroup(rows, day, group);
    var active = [];
    var inactive = [];
    matched.forEach(function (row) {
      var status = busRowStatus(row, date);
      (status.active ? active : inactive).push({ row: row, status: status });
    });
    return { matched: matched, active: active, inactive: inactive };
  }

  function busRowHtml(row, status) {
    var key = routeKey(row.route);
    var classes = [];
    if (key) classes.push("rte-" + key);
    if (status.className) classes.push(status.className);
    var routeInner = key
      ? '<span class="rte-badge rte-' + key + '">' + esc(row.route) + "</span>"
      : esc(row.route);
    if (status.badge) {
      routeInner += ' <span class="status-badge ' + esc(status.className) + '">' + esc(status.badge) + "</span>";
    }
    var note = esc(row.note || "");
    if (status.extra) note += (note ? " " : "") + esc(status.extra);
    return "<tr" + (classes.length ? ' class="' + classes.join(" ") + '"' : "") + ">" +
      '<td class="time">' + esc(row.time) + "</td>" +
      "<td>" + esc(row.company) + "</td>" +
      "<td>" + routeInner + "</td>" +
      "<td>" + esc(row.origin || row.dest || "") + "</td>" +
      "<td>" + note + "</td></tr>";
  }

  function relLum(hex) {
    var n = hex.replace("#", "");
    function ch(i) {
      var c = parseInt(n.slice(i, i + 2), 16) / 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    }
    return 0.2126 * ch(0) + 0.7152 * ch(2) + 0.0722 * ch(4);
  }

  function contrastRatio(fg, bg) {
    var a = relLum(fg);
    var b = relLum(bg);
    var hi = Math.max(a, b);
    var lo = Math.min(a, b);
    return (hi + 0.05) / (lo + 0.05);
  }

  function eventDisplay(train, field) {
    var value = train[field];
    if (value == null || value === "") {
      var bothUnknown = (train.arrival == null || train.arrival === "") &&
        (train.departure == null || train.departure === "");
      if (bothUnknown || train.unpublished_event === field) return "時刻未確認";
      return null;
    }
    var text = String(value);
    if (train.approximate && text.indexOf("頃") === -1) text += "頃";
    return text;
  }

  function directionViews(train) {
    var restriction = train.boarding_restriction || "";
    if (restriction.indexOf("降車のみ") !== -1) return { arrival: true, departure: false };
    if (restriction.indexOf("乗車のみ") !== -1) return { arrival: false, departure: true };
    var arrival = eventDisplay(train, "arrival");
    var departure = eventDisplay(train, "departure");
    if (arrival && departure) return { arrival: true, departure: true };
    if (arrival && !departure) return { arrival: true, departure: false };
    if (departure && !arrival) return { arrival: false, departure: true };
    return { arrival: true, departure: true };
  }

  function trainById(data) {
    var map = {};
    (data.trains || []).forEach(function (t) { map[t.id] = t; });
    return map;
  }

  function evaluateTrain(train, ymd) {
    var op = train.operation || {};
    var inRange = !!op.valid_from && !!op.valid_to && ymd >= op.valid_from && ymd <= op.valid_to;
    var planned = "unconfirmed";
    var note = "";
    if (op.mode === "single_date_primary_tour_organizer") {
      if ((op.scheduled_dates || []).indexOf(ymd) !== -1) {
        planned = "scheduled";
        note = "企画実施会社の行程で、この日の由布院停車が案内されています。";
      } else {
        planned = "not_scheduled";
        note = "この貸切の由布院停車日ではありません。";
      }
      if (train.note) note += train.note;
    } else if (!inRange) {
      planned = "unconfirmed";
      note = "確認済みの期間（" + (op.valid_from || "不明") + "〜" + (op.valid_to || "不明") + "）の外です。期間の外を毎日運転とは扱いません。";
    } else if (op.mode === "explicit_complete") {
      if ((op.scheduled_dates || []).indexOf(ymd) !== -1) planned = "scheduled";
      else if ((op.non_scheduled_dates || []).indexOf(ymd) !== -1) planned = "not_scheduled";
      else planned = "unconfirmed";
      if (planned === "not_scheduled") note = "公表された運転日にはこの列車名は入っていません。欠便の障害とは別です。";
      if (planned === "unconfirmed") note = "期間内ですが、運転日と非設定日のどちらにもこの日付がありません。";
    } else if (op.mode === "positive_only_direct_jr_sales") {
      if ((op.scheduled_dates || []).indexOf(ymd) !== -1) {
        planned = "scheduled";
        note = "JR企画の発売日として、この方向の計画があります。反対方向や白抜きの日は、これだけでは決まりません。";
      } else {
        planned = "unconfirmed";
        note = "この方向をJR企画の発売日とは確認できていません。発売日に無いことは運休の証明ではなく、貸切があり得ます。";
      }
    } else if (op.mode === "calendar_not_decoded") {
      planned = "unconfirmed";
      note = "日付ごとの運転カレンダーは未確認です。曜日の型からは運転日を作りません。";
    } else if (op.mode === "rail_days_known_station_schedule_unconfirmed") {
      planned = "unconfirmed";
      if ((op.rail_days || []).indexOf(ymd) !== -1) {
        note = "鉄道の移動日として案内があります。由布院駅の着発時刻は未確認で、候補の時刻は使っていません。";
      } else if ((op.tour_departure_dates || []).indexOf(ymd) !== -1) {
        note = "ツアーの初日です。由布院駅の着発日とは限らず、時刻も未確認です。";
      } else {
        note = "この日の由布院駅の着発は未確認です。";
      }
    } else if (op.mode === "tour_departure_dates_only_station_schedule_unconfirmed") {
      planned = "unconfirmed";
      if ((op.tour_departure_dates || []).indexOf(ymd) !== -1) {
        note = "この日はツアー出発日です。出発日を由布院駅の着発日とは扱わず、駅の時刻も未確認です。";
      } else {
        note = "由布院駅の着発日と時刻は未確認です。ツアー出発日だけでは駅の日付を決めません。";
      }
    } else if (op.mode === "tour_dates_known_times_require_primary_visual_verification") {
      planned = "unconfirmed";
      if ((op.tour_departure_dates || []).indexOf(ymd) !== -1) {
        note = "この日はツアー出発日です。由布院駅の時刻は一次資料の図で確認できていないため、未確認のままです。";
      } else {
        note = "由布院駅の着発は未確認です。毎週の繰り返しでは作りません。";
      }
    } else {
      planned = "unconfirmed";
      note = "この日の運転計画を決める資料がありません。";
    }
    if (train.booking) note += (note ? " " : "") + train.booking;
    if (train.boarding_restriction) note += (note ? " " : "") + train.boarding_restriction;
    var live = train.live_status || "unconfirmed";
    var liveLabel = LIVE_LABEL[live] || "運行状況未確認";
    return {
      id: train.id,
      name: train.name,
      planned_status: planned,
      planned_label: PLANNED_LABEL[planned] || "未確認",
      live_status: live,
      live_label: liveLabel,
      arrival_display: eventDisplay(train, "arrival"),
      departure_display: eventDisplay(train, "departure"),
      views: directionViews(train),
      note: note,
      summary: (PLANNED_LABEL[planned] || "未確認") + "。" + note + liveLabel + "。",
      route_text: (train.origin || "起点未確認") + " → " + (train.destination || "行先未確認"),
      counts_as_active: planned === "scheduled",
      valid_from: op.valid_from || "",
      valid_to: op.valid_to || ""
    };
  }

  function sourceLinks(data, train) {
    var map = {};
    (data.sources || []).forEach(function (s) { map[s.id] = s; });
    return (train.source_ids || []).map(function (id) { return map[id]; }).filter(Boolean);
  }

  function seasonalGroup(train, direction) {
    if (train.id === "aru_am" || train.id === "aru_pm" || train.id === "kanpachi" || train.id === "ichiroku") return "hita";
    if (direction === "arrival") {
      if (train.origin === "博多" || train.origin === "日田") return "hita";
      if (train.origin === "別府" || train.origin === "大分") return "oita";
    } else {
      if (train.destination === "博多" || train.destination === "日田") return "hita";
      if (train.destination === "別府" || train.destination === "大分") return "oita";
    }
    return "seasonal";
  }

  function timeSortKey(value) {
    var m = /^(\d{1,2}):(\d{2})/.exec(String(value || ""));
    if (!m) return 24 * 60 + 1;
    return Number(m[1]) * 60 + Number(m[2]);
  }

  function statusClass(planned) {
    if (planned === "scheduled") return "plan-scheduled";
    if (planned === "not_scheduled") return "plan-off";
    if (planned === "timetable") return "";
    return "plan-unconfirmed";
  }

  function buildJrDirection(regularRows, data, date, direction) {
    var byId = trainById(data);
    var rows = regularRows.map(function (row) {
      var id = REGULAR_SEASONAL[row.route];
      var out = {};
      Object.keys(row).forEach(function (k) { out[k] = row[k]; });
      if (!id || !byId[id]) {
        out.planned_status = "timetable";
        out.status_badge = "";
        out.status_class = "";
        return out;
      }
      var ev = evaluateTrain(byId[id], date);
      var pairId = REPLACEMENT_OF[id];
      var pair = pairId && byId[pairId] ? evaluateTrain(byId[pairId], date) : null;
      out.seasonal_id = id;
      out.planned_status = ev.planned_status;
      if (pair && pair.planned_status === "scheduled" && ev.planned_status === "not_scheduled") {
        out.route = byId[pairId].name;
        out.seasonal_id = pairId;
        out.planned_status = "scheduled";
        out.status_badge = "運転予定";
        out.status_class = "plan-scheduled";
        out.note = (row.note ? row.note + " " : "") +
          "この日は" + byId[pairId].name + "の運転予定（同時刻・同停車駅）。" +
          byId[id].name + "は運転設定なし。運行状況は未確認。";
      } else if (ev.planned_status === "scheduled") {
        out.status_badge = "運転予定";
        out.status_class = "plan-scheduled";
        var extra = "この日は" + byId[id].name + "の運転予定。運行状況は未確認。";
        if (pair && pair.planned_status === "not_scheduled") {
          extra = "この日は" + byId[id].name + "の運転予定。" + byId[pairId].name + "は運転設定なし。運行状況は未確認。";
        }
        out.note = (row.note ? row.note + " " : "") + extra;
      } else if (ev.planned_status === "unconfirmed") {
        out.status_badge = "未確認";
        out.status_class = "plan-unconfirmed";
        out.note = (row.note ? row.note + " " : "") +
          "この日の列車名は未確認です。期間の外をゆふ73号・74号には読み替えません。運行状況も未確認。";
      } else {
        out.status_badge = "運転設定なし";
        out.status_class = "plan-off";
        out.note = (row.note ? row.note + " " : "") + "この日は運転設定なし。運行状況は未確認。";
      }
      return out;
    });

    data.trains.forEach(function (train) {
      if (COVERED_BY_REGULAR[train.id]) return;
      var ev = evaluateTrain(train, date);
      if (!ev.views[direction]) return;
      var display = direction === "arrival" ? ev.arrival_display : ev.departure_display;
      if (display == null) return;
      var extra = {
        time: display,
        company: "JR九州",
        route: train.name,
        note: ev.summary,
        days: ["weekday", "weekend"],
        group: seasonalGroup(train, direction),
        kind: "limited",
        planned_status: ev.planned_status,
        status_badge: ev.planned_label,
        status_class: statusClass(ev.planned_status),
        seasonal_id: train.id,
        seasonal: true
      };
      if (direction === "arrival") extra.origin = ev.route_text;
      else extra.dest = ev.route_text;
      rows.push(extra);
    });

    rows.sort(function (a, b) {
      var d = timeSortKey(a.time) - timeSortKey(b.time);
      if (d) return d;
      return String(a.route).localeCompare(String(b.route), "ja");
    });
    return rows;
  }

  function isActiveJrRow(row) {
    return !row.planned_status || row.planned_status === "timetable" || row.planned_status === "scheduled";
  }

  function filterJrRows(rows, day, group) {
    return rows.filter(function (a) {
      if (a.days && a.days.indexOf(day) === -1) return false;
      if (group === "all") return true;
      if (group === "seasonal") return !!(a.seasonal_id || a.seasonal);
      return a.group === group;
    });
  }

  function jrRowHtml(row) {
    var classes = [];
    if (row.kind === "limited") classes.push("kind-limited");
    if (row.status_class) classes.push(row.status_class);
    var routeCell = row.kind === "limited"
      ? '<span class="kind-badge">' + esc(row.route) + "</span>"
      : '<span class="kind-local">' + esc(row.route) + "</span>";
    if (row.status_badge) {
      routeCell += ' <span class="status-badge ' + esc(row.status_class || "") + '">' + esc(row.status_badge) + "</span>";
    }
    return "<tr" + (classes.length ? ' class="' + classes.join(" ") + '"' : "") + ">" +
      '<td class="time">' + esc(row.time) + "</td>" +
      "<td>" + esc(row.company) + "</td>" +
      "<td>" + routeCell + "</td>" +
      "<td>" + esc(row.origin || row.dest || "") + "</td>" +
      "<td>" + esc(row.note || "") + "</td></tr>";
  }

  function seasonalCardRows(data, date, direction) {
    return (data.trains || []).map(function (train) {
      var ev = evaluateTrain(train, date);
      ev.sources = sourceLinks(data, train);
      ev.clock = direction === "arrival" ? ev.arrival_display : ev.departure_display;
      return ev;
    }).filter(function (ev) { return ev.views[direction]; });
  }

  function calendarBanner(date) {
    if (date > "2027-02-28") {
      return "2027年3月1日以降の詳しい運転日は、確認したゆふいんの森の案内では2027年1月中旬頃の発表とされています。この日は未確認で、2月までの曜日パターンは使いません。";
    }
    if (date < "2026-10-01") {
      return "2026年10月1日より前は、この季節列車一覧の確認範囲の外です。未確認です。";
    }
    return "";
  }

  function seasonalCardHtml(data, date, direction, now) {
    var rows = seasonalCardRows(data, date, direction);
    var stale = isStale(data.checked_at, now || new Date(), data.stale_after_hours || 24);
    var banner = calendarBanner(date);
    var html = "";
    if (stale) {
      html += '<p class="stale-banner" role="status">' + esc(data.safe_failed_message || "最新情報を確認できません。前回確認時の参考情報です。公式サイトでご確認ください。") + "</p>";
    }
    if (banner) html += '<p class="stale-banner" role="status">' + esc(banner) + "</p>";
    html += '<p class="caption">計画の確認時刻 ' + esc(formatCheckedAt(data.checked_at)) +
      "。ページを開いた時刻ではありません。運転予定は公表された計画で、走っていることの確認ではありません。</p>";
    html += '<p class="caption">或る列車は、JR企画の発売日が確認できた方向だけを運転予定にします。白抜きや反対方向は運休にしません。かんぱち・いちろくの日付別カレンダーは未確認で、曜日からは決めません。ななつ星は、駅時刻を確認できた貸切以外は時刻未確認です。</p>';
    html += "<table><thead><tr><th>計画</th><th>運行状況</th><th>" +
      (direction === "arrival" ? "到着" : "出発") +
      "</th><th>列車</th><th>内容</th></tr></thead><tbody>";
    rows.forEach(function (ev) {
      var links = (ev.sources || []).map(function (s) {
        var when = s.published_as_of ? "（資料の日付 " + s.published_as_of + "）" : "";
        return '<a href="' + esc(s.url) + '">' + esc(s.title) + "</a>" + esc(when);
      }).join("、");
      html += '<tr class="' + statusClass(ev.planned_status) + '">' +
        "<td>" + esc(ev.planned_label) + "</td>" +
        "<td>" + esc(ev.live_label) + "</td>" +
        '<td class="time">' + esc(ev.clock || "時刻未確認") + "</td>" +
        "<td>" + esc(ev.name) + "</td>" +
        "<td>" + esc(ev.summary) + (links ? " 出典: " + links : "") +
        " 期間 " + esc(ev.valid_from) + "〜" + esc(ev.valid_to) + "</td></tr>";
    });
    html += "</tbody></table>";
    return html;
  }

  function noticeApplies(notice, date) {
    if (!notice || !date) return false;
    if (notice.effective_from && date < notice.effective_from) return false;
    if (notice.effective_until && date > notice.effective_until) return false;
    return true;
  }

  function renderDisruption(data, selectedDate, now) {
    var source = data || {};
    var failed = source.safe_failed_message || "最新情報を確認できません。前回確認時の参考情報です。公式サイトでご確認ください。";
    if (!source.current_relevant_notices && !source.upcoming_relevant_notices) {
      return '<p class="stale-banner">' + esc(failed) + "</p>";
    }
    var stale = isStale(source.checked_at || source.generated_at, now || new Date(), source.stale_after_hours);
    var html = "";
    if (stale) html += '<p class="stale-banner" role="status">' + esc(failed) + "</p>";
    html += '<p class="disruption-kicker">今の告知</p>';
    var current = source.current_relevant_notices || [];
    if (!current.length) {
      html += "<p>" + esc(source.safe_empty_message || "") + "</p>";
    }
    current.forEach(function (n) {
      var on = noticeApplies(n, selectedDate);
      html += '<article class="notice notice-current">' +
        "<h3>" + esc(n.route) + " <span class=\"status-badge is-suspended\">運休</span></h3>" +
        "<p>" + esc(n.summary) + (on ? " 表示日にはこの告知がかかっています。" : "") + "</p>" +
        '<p class="notice-meta"><a href="' + esc(n.source_url) + '">告知原文</a>';
      if (n.source_list_url) html += ' ・ <a href="' + esc(n.source_list_url) + '">お知らせ一覧</a>';
      html += "<br>" + esc(n.source_time_note || "") + "</p></article>";
    });
    html += '<p class="disruption-kicker">予定の告知</p>';
    (source.upcoming_relevant_notices || []).forEach(function (n) {
      var on = noticeApplies(n, selectedDate);
      html += '<article class="notice notice-planned">' +
        "<h3>" + esc(n.route) + " <span class=\"status-badge plan-unconfirmed\">予定</span></h3>" +
        "<p>" + esc(n.summary) + (on ? " 表示日がこの運休日です。" : " 表示日の運休とは別の予定です。") + "</p>" +
        '<p class="notice-meta"><a href="' + esc(n.source_url) + '">告知原文</a>';
      if (n.relevance_source_url) html += ' ・ <a href="' + esc(n.relevance_source_url) + '">別府–湯布院コースの告知</a>';
      html += "<br>" + esc(n.source_time_note || "") + " " + esc(n.relevance || "") + "</p></article>";
    });
    html += '<p class="disruption-kicker">確認できた範囲</p><ul class="source-status">';
    (source.source_status || []).forEach(function (s) {
      html += "<li><a href=\"" + esc(s.url) + "\">" + esc(s.name) + "</a>：" + esc(s.reason || s.status || "");
      if (s.notice_url) html += ' <a href="' + esc(s.notice_url) + '">休止の告知</a>';
      html += "</li>";
    });
    html += "</ul>";
    html += '<p class="disruption-coverage">' + esc(source.coverage_note || "") + "</p>";
    html += '<p class="disruption-checked">確認時刻 ' + esc(source.checked_window_jst || formatCheckedAt(source.checked_at)) +
      "。リアルタイムの運行情報ではありません。このページを開いた時刻ではなく、保存した確認結果です。</p>";
    return html;
  }

  function panelsFor(mode, dir) {
    return {
      "panel-bus": mode === "bus" && dir === "arr",
      "panel-bus-dep": mode === "bus" && dir === "dep",
      "panel-jr": mode === "jr" && dir === "arr",
      "panel-jr-dep": mode === "jr" && dir === "dep"
    };
  }

  function initialViewFromHash(hash) {
    if (!hash) return null;
    if (hash.indexOf("jr-dep") !== -1) return { mode: "jr", dir: "dep" };
    if (hash.indexOf("bus-dep") !== -1) return { mode: "bus", dir: "dep" };
    if (hash.indexOf("jr") === 1) return { mode: "jr", dir: "arr" };
    return null;
  }

  function eachDate(from, to, fn) {
    var ymd = from;
    while (ymd <= to) {
      fn(ymd);
      ymd = addDays(ymd, 1);
    }
  }

  return {
    PLANNED_LABEL: PLANNED_LABEL,
    LIVE_LABEL: LIVE_LABEL,
    ROUTE_CONTRAST: ROUTE_CONTRAST,
    esc: esc,
    jstYmd: jstYmd,
    weekdayIndex: weekdayIndex,
    formatJaDate: formatJaDate,
    addDays: addDays,
    busDayForDate: busDayForDate,
    formatCheckedAt: formatCheckedAt,
    isStale: isStale,
    routeKey: routeKey,
    busRowStatus: busRowStatus,
    filterByDayGroup: filterByDayGroup,
    partitionBus: partitionBus,
    busRowHtml: busRowHtml,
    contrastRatio: contrastRatio,
    eventDisplay: eventDisplay,
    directionViews: directionViews,
    evaluateTrain: evaluateTrain,
    sourceLinks: sourceLinks,
    seasonalGroup: seasonalGroup,
    timeSortKey: timeSortKey,
    buildJrDirection: buildJrDirection,
    isActiveJrRow: isActiveJrRow,
    filterJrRows: filterJrRows,
    jrRowHtml: jrRowHtml,
    seasonalCardRows: seasonalCardRows,
    seasonalCardHtml: seasonalCardHtml,
    calendarBanner: calendarBanner,
    noticeApplies: noticeApplies,
    renderDisruption: renderDisruption,
    panelsFor: panelsFor,
    initialViewFromHash: initialViewFromHash,
    eachDate: eachDate
  };
});
