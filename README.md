<p align="center">
  <img src="static/brand/logo.jpg" width="96" alt="OpenAIGames 吉祥物" />
</p>

<h1 align="center">OpenAIGames</h1>

<p align="center">一起，做点好玩的。</p>

<p align="center">
  <a href="https://openaigames.org/">进入游戏房间</a> ·
  <a href="https://openaigames.org/#/submit">提交游戏</a> ·
  <a href="https://github.com/openaigames/community">参与社区</a>
</p>

<p align="center">简体中文 · <a href="README.en.md">English</a></p>

OpenAIGames 是一个一起做游戏、玩游戏、探索 AI 创作工具与流程的社区。这个仓库存放社区网站源码：一个可以挑选卡带、试玩作品、交流反馈的 3D 游戏房间。

## 来玩一会儿

- **挑一张卡带**：左侧是精选游戏，右侧是社区试玩，也可以打开目录搜索。
- **全屏试玩**：点击卡带开始游戏，随时打开评分和评论，再回到当前游戏。
- **留点反馈**：登录 GitHub 后，可以打分、点赞和评论。
- **逛逛房间**：听音乐、许愿留言，或者看看大家如何一起共创。支持中英文和手机操作。

## 一起参与

| 想做什么 | 从这里开始 |
| --- | --- |
| 分享一个可玩的作品 | [网页快捷投稿](https://openaigames.org/#/submit)，审核后进入社区试玩 |
| 用 PR 留下项目资料 | [社区投稿指南](https://github.com/openaigames/community/blob/main/docs/GAME_SUBMISSION.md) |
| 做游戏、共建工具与 pipeline | [社区仓库](https://github.com/openaigames/community) |
| 改进网站或反馈问题 | 在本仓库 [提 Issue](https://github.com/openaigames/website/issues) 或提交 PR |

游戏项目资料沉淀在 `community`，网站界面、交互和服务端维护在 `website`。

## 本地运行

需要 Node.js 22 或更新的受支持版本。

```sh
npm ci
npm run build
npm run db:local
npm run dev
```

打开 [localhost:8499](http://127.0.0.1:8499/)。修改源码后重新运行 `npm run build`；自动检查使用 `npm test`。本地默认读取随仓库提供的游戏目录，留言和投稿使用本地数据库。

网站使用 **Three.js · Cloudflare Workers · D1**。登录、审核和部署配置见[开发文档](docs/DEVELOPMENT.md)。

## 文档与维护

| 文档 | 内容 |
| --- | --- |
| [开发与部署](docs/DEVELOPMENT.md) | 本地环境、发布流程、目录同步与 i18n |
| [房间交互](docs/ROOM.md) | 镜头、触控、全屏游戏、反馈和音乐 |
| [登录与审核](docs/AUTH_AND_MODERATION.md) | GitHub 登录、投稿审核和权限校验 |
| [访问统计](docs/ANALYTICS.md) | PV、估算 UV、游戏打开次数与统计口径 |

管理员在[管理后台](https://openaigames.org/admin)审核投稿、查看数据。后台源码包含在本仓库中，权限由服务端校验；密钥、登录会话和用户数据不随源码公开。

## 许可

网站原创代码采用 [MIT License](LICENSE)。第三方游戏、美术、字体和依赖保留各自许可，详见 [Third-party notices](THIRD_PARTY_NOTICES.md)。
