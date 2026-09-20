# Optional game runtime bridge / 游戏运行数据接入

展厅能知道有人打开了卡带，但跨域 iframe 的 `load` 事件不能证明游戏成功加载。接入下面这个小脚本后，游戏可以明确告诉展厅：已就绪、开始一局、暂停和恢复。未接入的游戏继续正常试玩，后台显示“未确认”。

The room can observe an iframe opening, but that is not proof of a working game. This optional script lets an author explicitly confirm readiness, round starts, pauses and resumes. Games without it continue working and remain **unconfirmed** in analytics.

## 接入 / Integration

复制 [game-telemetry.js](../static/game-telemetry.js) 到游戏项目，自行托管并保留 v1 协议。也可以引用正式站的脚本。将下面的调用接到真正的游戏生命周期，**不要在 HTML 加载时自动调用 ready / start**。

Copy and self-host the script, or load it from the main site. Wire these methods to the real lifecycle, **not merely HTML loading**:

```html
<script src="https://openaigames.org/static/game-telemetry.js?v=1"></script>
<script>
  // After essential assets, scene and input controls are usable:
  // 核心资源、场景和操作全部就绪后：
  window.OpenAIGamesGame?.ready();

  // When the player actually starts a new round:
  // 玩家真正开始新的一局：
  window.OpenAIGamesGame?.start();

  // Connect these separately to the pause/resume controls.
  // 暂停 / 恢复，不增加新的一局：
  // window.OpenAIGamesGame?.pause();
  // window.OpenAIGamesGame?.resume();

  // Optional fatal runtime / resource failure, without text or stack traces:
  // window.OpenAIGamesGame?.error();
</script>
```

Above calls illustrate lifecycle hooks; do not paste them as an unconditional sequence. Pausing or finishing a round should call `pause()`; only a new round calls `start()`. `resume()` does not increase round count. The room records exit when the iframe is removed, replaced, or its document leaves. Opening a review overlay is not an exit.

上面的调用只是位置示例，请分别放进游戏的对应回调里；结束一局调用 `pause()`，恢复同一局调用 `resume()`。换卡、销毁 iframe 或离开展厅才记退出，打开评价弹窗不记退出。

## 时长与隐私 / Timing & privacy

- Effective time requires `ready()` then `start()`, a visible/focused game and input within the past 60 seconds. The SDK samples every 5 seconds; input only updates an activity timestamp. It does not send keys, pointer positions, search text, player names, save data or network requests to a collector.
- The parent filters hidden, unfocused and overlay-covered time again, clamps deltas to observed elapsed time, saves a cumulative maximum every 15 seconds and tries to flush on exit. Suspended-device gaps are discarded. This is best-effort, author-reported time, not independently verified gameplay or an anti-cheat measurement. Gamepad-only and passive play can be undercounted after inactivity; browsers may drop the final save.
- Parent DNT/GPC, `?analytics=off`, preview isolation and the 90-day retention policy still apply. Outside an allowed embedded room, the SDK does not activate.
- No separate third-party analytics account or credentials are needed. The server stores anonymous browser digests separately from GitHub identities.

有效时长是尽力估算，自动排除后台、弹窗遮挡和长时间无输入；手柄独占输入和长时间静态玩法可能少计。它不能替代游戏自身的精确统计，也不用于反作弊。

## Protocol v1

The game sends `oag:telemetry:hello` to an explicitly allowed parent origin. The parent accepts only the current iframe's `source` and configured play URL's exact origin, and replies with `oag:telemetry:init`, version 1 and a fresh random nonce. The game echoes that nonce in `oag:telemetry:event` messages. Events are `ready`, `start`, `pause`, `resume`, `active` (integer `deltaMs`, 0–10000), and `error` (no free text).

Allowed production parents are `https://openaigames.org`, `https://openaigames.lens-frontier.workers.dev` and `https://openaigames.3325932294.workers.dev`. Local testing permits `http://127.0.0.1:<port>`. Neither side uses `*` as target origin. Replacing the iframe disposes its listener, so late messages from an old cartridge cannot affect the next game. If the play URL redirects to a different origin, use the final playable URL in the catalog; do not widen the allowlist to arbitrary sites.

This handshake prevents unrelated/stale frames from updating a run; a game's own script can still self-report inaccurate results. It does not confer trust or grant account access.

See [analytics definitions](ANALYTICS.md) for cohort and reporting details.
