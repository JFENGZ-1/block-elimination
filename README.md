# Block Elimination（坨坨方块）

一个原创视觉的“坨坨方块”拖动模式学习项目。当前版本可直接运行在 H5：玩家将底部三个备选拼块拖入 10 × 10 棋盘，填满完整横行或竖列后消除并得分。

## 已实现

- 三选拼块、拖拽落子、合法落点预览
- 横向与纵向消除、连续消除加分、无可用位置结束
- 消除闪光、彩色粒子、奖励分弹跳和连击动效
- Web Audio 落子、消除、连击与游戏结束音效，可一键静音
- 单步撤回、重新开始、触屏与鼠标操作
- PHP + MySQL 全服注册登录、会话保持、个人最高分和全服排行榜
- 桌面端与移动端响应式界面
- 独立 TypeScript 游戏规则引擎
- 宝塔 Nginx 一次性可视化安装页面

## 运行

```bash
npm install
npm run dev
```

生产构建：

```bash
npm run build
```

生成宝塔部署包：

```bash
npm run build:baota
```

生成关闭调试模式、可直接提交和升级的生产目录：

```bash
npm run build:production
```

游戏引擎测试：

```bash
npm run test:engine
```

## 主要目录

- `src/game/RossGame.ts`：平台无关的棋盘、拼块、消除、计分和结束判定
- `src/components/BlockPlayfield.vue`：H5 拖拽与触屏交互
- `src/services/apiAccountService.ts`：全服账号、成绩和排行榜接口
- `src/stores/account.ts`：登录态与榜单状态
- `server/api`：PHP 8.2 JSON API 和一次性安装页面
- `server/schema.sql`：MySQL 5.7 数据表

## 服务器部署

适用于宝塔面板、Nginx、PHP 8.2 和 MySQL 5.7。完整流程参见 [`server/BAOTA_DEPLOY.md`](server/BAOTA_DEPLOY.md)。

数据库密码保存在服务器的 `server/api/config.php` 中，该文件已加入 `.gitignore`，不要提交到仓库。

### 宝塔一键升级

仓库为公开仓库，服务器无需配置 GitHub 密钥。首次部署和以后升级均可执行同一条命令：

```bash
bash -lc 'set -e; ROSS_REPO=/www/server/block-elimination; [ -d "$ROSS_REPO/.git" ] || git clone https://github.com/JFENGZ-1/block-elimination.git "$ROSS_REPO"; git -C "$ROSS_REPO" pull --ff-only origin main; bash "$ROSS_REPO/scripts/upgrade-baota.sh" /www/wwwroot/demo.zjzoo.me'
```

脚本会将已经关闭调试模式的 `deploy/wwwroot` 覆盖到 `/www/wwwroot/demo.zjzoo.me`，并保留服务器现有的 `api/config.php` 数据库配置。若站点目录不同，可将目录作为参数传入脚本。

## 迁移到微信小游戏

当前 H5 界面使用 Vue 和 DOM，不能原样作为微信小游戏界面发布；迁移时可直接复用 `RossGame.ts` 的规则层，并完成以下替换：

1. 使用 Canvas 2D 或小游戏引擎重写棋盘绘制与触摸拖拽层。
2. 用 `wx.login` 获取登录凭证，由云函数或自建服务端换取玩家身份。
3. 将本地账号服务替换为云数据库接口；密码注册可取消，改用微信授权登录。
4. 好友榜接入微信开放数据域；全服榜由云函数校验并写入，不能信任客户端上报的分数。
5. 增加分包、资源压缩、弱网重试、生命周期暂停和真机性能测试。

项目未复制原游戏商标素材、图标或音效；正式商业发布前仍应完成名称、玩法表现和素材的知识产权审核。
