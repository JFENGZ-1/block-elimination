# 罗斯方块：宝塔部署说明

## 1. 宝塔环境

在“软件商店”确认已安装：

- Nginx
- MySQL 5.7（数据库脚本已按 5.7 兼容语法编写）
- PHP 8.2
- PHP 扩展：`pdo_mysql`、`mbstring`、`openssl`

在“网站”中新建站点并绑定游戏域名，PHP 版本选择 8.2。申请 Let's Encrypt 证书并开启强制 HTTPS。

## 2. 创建数据库

在宝塔“数据库”中新建一个数据库与独立数据库用户。记下数据库名称、用户名和密码。

推荐直接使用第 4 节的一次性配置页面，它会自动导入数据表。需要手动导入时，再进入 phpMyAdmin，选中该数据库后导入：

`database/schema.sql`

数据库表使用 InnoDB 和 `utf8mb4`，包含玩家、登录会话和成绩提交记录。

## 3. 上传发布文件

本机执行：

```bash
npm run build:baota
```

将 `release/baota/wwwroot/` 内的全部文件上传到宝塔站点根目录。

## 4. 使用一次性配置页面（推荐）

发布包根目录包含 `SETUP_KEY.txt`。上传 `wwwroot` 后，先确保 PHP 能在首次安装时创建配置文件：

```bash
chown -R www:www /www/wwwroot/你的域名/api
chmod 750 /www/wwwroot/你的域名/api
```

复制 `SETUP_KEY.txt` 中的完整配置地址到浏览器，填写宝塔数据库信息，然后点击“测试并完成配置”。页面会自动测试连接、导入 MySQL 5.7 数据表并生成 `config.php`。成功后安装页自动锁定，安装密钥文件会尽可能自动删除。

完成后建议执行：

```bash
chown root:www /www/wwwroot/你的域名/api/config.php
chmod 640 /www/wwwroot/你的域名/api/config.php
chmod 755 /www/wwwroot/你的域名/api
rm -f /www/wwwroot/你的域名/api/.setup-key.php
```

如果不使用配置页面，也可以手动执行：

```bash
cd /www/wwwroot/你的域名/api
cp config.example.php config.php
```

编辑 `config.php`，填写宝塔创建的数据库名、用户名和密码。随后限制权限：

```bash
chown root:www config.php
chmod 640 config.php
```

## 5. 配置 Nginx

打开宝塔站点的“配置文件”，把 `nginx-baota-snippet.conf` 中的 location 配置加入当前 `server { ... }` 内。如果站点原本已有 `location / { ... }`，请用片段里的同名配置替换它，不能同时保留两个 `location /`。

保留宝塔自动生成的 PHP 配置，例如：

```nginx
include enable-php-82.conf;
```

保存配置并重载 Nginx。

## 6. 验证

依次访问：

```text
https://你的域名/api/health
https://你的域名/
```

健康接口应返回：

```json
{"ok":true,"service":"ross-blocks-api"}
```

然后在网页中注册两个测试账号，分别完成一局，确认排行榜能在不同设备上看到相同成绩。

## 7. 上线注意事项

- 旧学习版账号只存在于原浏览器，密码哈希无法迁移，需要重新注册全服账号。
- 当前服务端限制单局最高 1,000,000 分、最多 10,000 次消除，可在 `api/config.php` 调整。
- 当前成绩由客户端上报，能够阻止普通越界数据，但不能完全阻止修改客户端后的作弊。正式商业上线前建议增加局记录签名、行为校验或服务端回放。
- 定期备份 `users`、`sessions`、`score_submissions` 三张表。
- 不要把 `api/config.php`、数据库密码或备份文件提交到代码仓库。
