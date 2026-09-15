---
name: openaigames-submit-demo
description: 向 OpenAIGames 社区仓库提交或更新可试玩游戏，验证 game.json 资料，并返回自动生成的 PR 预览供检查。
---

# 向 OpenAIGames 投稿游戏

本 Skill 用于 `openaigames/community` 的游戏投稿和目录更新，不负责构建或部署游戏本身的源码。展厅目前运行在 Cloudflare，投稿者不需要它的凭据。

阅读[投稿指南](https://github.com/openaigames/community/blob/main/docs/GAME_SUBMISSION.md)和当前的[游戏模板](https://github.com/openaigames/community/blob/main/templates/game.json)。在仓库中工作时，使用本地文件和维护中的校验器，不要自行重建字段规范。

- 检查已有的 `demos/` 记录和未关闭的 PR，沿用游戏的稳定 ID，避免重复投稿。
- 添加或更新 `demos/<id>/game.json`、`README.md` 以及同目录的封面图。从用户的游戏和已发布文档中整理资料。保留作者和第三方署名，区分概念艺术与实际游戏截图。
- 默认设置 `featured: false`。新投稿合并后进入完整目录，首页精选由维护者决定。普通投稿不要修改 `catalog/legacy.json`。
- 使用可正常访问的 HTTPS 试玩地址。游戏代码有改动时，先在游戏自身的仓库中部署。不要暗示社区 PR 会构建游戏本体。
- `submission_url` 可以指向社区归档文档，不要编造尚未创建的 PR 编号。不要包含令牌、私有地址、未发布草稿或玩家数据。
- 运行 `node tooling/catalog/validate-local.mjs` 和 `git diff --check`。验证试玩页面和操作说明的准确性，不要填写编造的测试结果。
- 在用户授权范围内提交分支，并向 `openaigames/community:main` 创建或更新 PR。适当复用用户已有的 fork 或分支。未经针对本次创建的明确授权，不要创建公开仓库。
- 阅读 PR 的 `Game catalog / Preview` 检查和 `github-actions[bot]` 的预览评论。返回真实预览地址及其对应提交。打开预览，检查目录和试玩入口。失败时检查日志、修复具体问题，再推送到同一分支；检查尚未完成或已失败时，不要声称预览已准备好。
- 交付可用的 PR 预览后停止，除非用户也已授权合并。只合并预期且已检查的 PR；主分支发布会自动更新正式目录。发布失败时，说明正式站仍使用上一份目录。

后续修改保留在同一条 PR。未合并的预览记录不得进入正式目录。预览页引导用户在 PR 留反馈，不能向正式留言板写入内容。
