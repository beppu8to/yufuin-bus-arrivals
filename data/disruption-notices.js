var DISRUPTION_DATA = {
  "generated_at": "2026-11-14T13:18:22+09:00",
  "checked_at": "2026-11-14T13:18:22+09:00",
  "checked_window_jst": "2026-11-14 13:14–13:18 JST",
  "timezone": "Asia/Tokyo",
  "is_realtime": false,
  "stale_after_hours": 12,
  "coverage": "partial",
  "coverage_note": "一部の公式お知らせを確認した参考情報です。JRなど現在の運行状況を確認できていない情報源があります。九州のりものinfo.comは休止の告知が出ています。最新状況は各社公式サイトでご確認ください。",
  "safe_empty_message": "確認した情報源では、由布院に関係する運休・遅延のお知らせは見つかりませんでした。未確認の路線・情報源があります。平常運行を保証するものではありません。",
  "safe_failed_message": "最新情報を確認できません。前回確認時の参考情報です。公式サイトでご確認ください。",
  "current_relevant_notices": [
    {
      "id": "kamenoi-yufurin-20261017",
      "route": "観光快速ゆふりん",
      "operator": "亀の井バス",
      "type": "suspension",
      "summary": "観光快速ゆふりんは10月17日から当面、全便運休です。由布院方面は別府駅西口発の36番湯布院線をご確認ください。",
      "effective_from": "2026-10-17",
      "effective_until": null,
      "source_url": "https://kamenoibus.com/archive/3724.html",
      "source_list_url": "https://kamenoibus.com/archive/category/information",
      "source_listed_date": "2026-09-30",
      "source_time_note": "一覧の掲載日は2026年9月30日です。記事に発表時刻の表示はなく、時刻は補っていません。",
      "relevance": "告知が由布院方面と、代わりに見る36番湯布院線を示しています。"
    }
  ],
  "upcoming_relevant_notices": [
    {
      "id": "kamenoi-yunokaze-20261203",
      "route": "ゆのかぜ（別府–湯布院コース）",
      "operator": "亀の井バス",
      "type": "planned_suspension",
      "summary": "ゆのかぜは12月3日、車両の定期点検のため全便運休です。12月3日以外の運休を示す告知ではありません。",
      "effective_from": "2026-12-03",
      "effective_until": "2026-12-03",
      "source_url": "https://kamenoibus.com/archive/3728.html",
      "source_list_url": "https://kamenoibus.com/archive/category/information",
      "source_listed_date": "2026-11-04",
      "source_time_note": "一覧の掲載日は2026年11月4日です。発表時刻の表示はなく、時刻は補っていません。",
      "relevance_source_url": "https://kamenoibus.com/archive/3690.html",
      "relevance": "同じ事業者の告知では、2026年10月7日から12月13日のゆのかぜは別府–湯布院コースです。"
    },
    {
      "id": "kamenoi-yunokaze-winter-beppu-loop-20261214",
      "route": "ゆのかぜ（別府–湯布院コース）",
      "operator": "亀の井バス",
      "type": "planned_course_change",
      "summary": "ゆのかぜは2026年12月14日から2027年3月19日の冬季、「別府周遊コース」を運行します。この期間は別府－湯布院コースは運行しません。一部運休日があります。",
      "effective_from": "2026-12-14",
      "effective_until": "2027-03-19",
      "source_url": "https://kamenoibus.com/archive/3793.html",
      "source_list_url": "https://kamenoibus.com/archive/category/information",
      "source_listed_date": "2026-11-14",
      "source_time_note": "一覧の掲載日は2026年11月14日です。記事に「2026年11月14日 更新」とあり、発表時刻の表示はなく、時刻は補っていません。",
      "relevance": "告知が、冬季期間中は別府－湯布院コースを運行しないと明示しています。"
    }
  ],
  "source_status": [
    {
      "name": "九州のりものinfo.com",
      "url": "http://www.norimono-info.com/",
      "status": "unavailable",
      "reason": "加盟事業者の告知では、2026年10月22日20:00（日本時間）からセキュリティ対応で休止し、再開時期は未定です。この確認では通常運行の根拠にしていません。",
      "notice_url": "https://www.jrkbus.co.jp/news/detail/399",
      "notice_date": "2026-10-23"
    },
    {
      "name": "JR九州運行情報",
      "url": "https://www.jrkyushu.co.jp/trains/info/",
      "status": "unverified",
      "reason": "読み取れた結果はメンテナンス表示にとどまり、久大本線・ゆふ・ゆふいんの森の現在の運行は未確認です。サイトが止まっているとも、遅れがないとも断定していません。"
    },
    {
      "name": "亀の井バスお知らせ",
      "url": "https://kamenoibus.com/archive/category/information",
      "status": "partial_notices_reviewed",
      "reason": "由布院に関係する告知を確認しました。36番・37番などの今の遅れや運休をすべて見たという意味ではありません。"
    },
    {
      "name": "ゆふいん号（西鉄・日田バス・亀の井バス）",
      "url": "https://www.nishitetsu.jp/bus/highwaybus/rosen/yufuin/",
      "status": "route_identity_verified_live_status_unverified",
      "reason": "路線の案内は確認しました。この確認では現在の遅延・運休は未確認です。"
    },
    {
      "name": "九州横断バス（九州産交バス）",
      "url": "https://www.sankobus.jp/",
      "status": "live_status_unverified",
      "reason": "他路線の運休を由布院へは広げていません。現在の運行は未確認です。"
    },
    {
      "name": "湯布院ライナー（大分交通）",
      "url": "https://www.oitakotsu.co.jp/",
      "status": "live_status_unverified",
      "reason": "空港バスの運行状況ページはこの確認では読めず、湯布院便の現在の運行は未確認です。"
    }
  ]
};
