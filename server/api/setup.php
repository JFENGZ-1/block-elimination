<?php
declare(strict_types=1);

session_start([
    'cookie_httponly' => true,
    'cookie_samesite' => 'Strict',
    'use_strict_mode' => true,
]);

header('Content-Type: text/html; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: no-referrer');
header("Content-Security-Policy: default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'");

const CONFIG_PATH = __DIR__ . '/config.php';
const KEY_PATH = __DIR__ . '/.setup-key.php';
const SCHEMA_PATH = __DIR__ . '/schema.sql';

function h(string $value): string
{
    return htmlspecialchars($value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

function post(string $name, string $fallback = ''): string
{
    return trim((string) ($_POST[$name] ?? $fallback));
}

function render(string $content, string $title = '坨坨方块 · 服务器配置'): never
{
    echo '<!doctype html><html lang="zh-CN"><head><meta charset="UTF-8">';
    echo '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">';
    echo '<title>' . h($title) . '</title><style>
      :root{color-scheme:dark;font-family:system-ui,-apple-system,"PingFang SC",sans-serif;background:#062f48;color:#ecfbff}
      *{box-sizing:border-box}body{min-height:100vh;margin:0;display:grid;place-items:center;padding:22px;background:radial-gradient(circle at 50% 0,#20b9cf 0,#087a9d 30%,#052d47 75%)}
      main{width:min(100%,620px);padding:30px;border:1px solid #64d9e7;border-radius:26px;background:rgba(4,65,91,.9);box-shadow:0 24px 70px #001b2c88,inset 0 1px #ffffff35}
      h1{margin:0 0 8px;font-size:28px}p{color:#b8e8f0;line-height:1.65}.badge{display:inline-block;margin-bottom:16px;padding:6px 11px;border-radius:999px;background:#0b9cb5;color:#fff;font-size:12px}
      .grid{display:grid;grid-template-columns:1fr 120px;gap:14px}.full{grid-column:1/-1}label{display:grid;gap:7px;color:#bcecf4;font-size:13px}
      input{width:100%;height:46px;padding:0 13px;border:1px solid #318da5;border-radius:12px;background:#032f48;color:#fff;outline:none;font-size:16px}input:focus{border-color:#65edff;box-shadow:0 0 0 3px #41dff32b}
      button,.button{display:inline-flex;min-height:48px;align-items:center;justify-content:center;border:0;border-radius:14px;padding:0 20px;background:linear-gradient(#ffd866,#ff9c1a);color:#4d2c00;font-weight:800;font-size:16px;text-decoration:none;cursor:pointer;box-shadow:0 5px 0 #d56c08}
      .notice{margin:18px 0;padding:13px 15px;border-radius:13px;background:#052e46;border:1px solid #2f879d}.error{border-color:#ff7e72;color:#ffd2ce}.success{border-color:#67e69b;color:#c8ffdc}
      small{color:#83cbd7}.actions{margin-top:20px;display:flex;gap:12px;align-items:center}@media(max-width:520px){main{padding:22px}.grid{grid-template-columns:1fr}.full{grid-column:auto}}
    </style></head><body><main>' . $content . '</main></body></html>';
    exit;
}

if (is_file(CONFIG_PATH)) {
    render('<span class="badge">SETUP LOCKED</span><h1>服务器已经配置完成</h1><p>安装页面已自动锁定，不会显示或修改数据库信息。</p><div class="notice success">现在可以验证接口并进入游戏。</div><div class="actions"><a class="button" href="./health">检查接口</a><a class="button" href="../">进入游戏</a></div>');
}

$expectedKey = is_file(KEY_PATH) ? require KEY_PATH : '';
if (!is_string($expectedKey) || strlen($expectedKey) < 32) {
    render('<span class="badge">SETUP ERROR</span><h1>缺少安装密钥</h1><div class="notice error">请重新上传发布包中的 <code>.setup-key.php</code>，然后刷新页面。</div>');
}

$providedKey = (string) ($_POST['setup_key'] ?? $_GET['key'] ?? '');
if (!hash_equals($expectedKey, $providedKey)) {
    render('<span class="badge">ONE-TIME SETUP</span><h1>输入安装密钥</h1><p>密钥位于发布包根目录的 <code>SETUP_KEY.txt</code>，配置成功后立即失效。</p><form method="get"><label>安装密钥<input name="key" type="password" required autocomplete="off"></label><div class="actions"><button type="submit">进入配置</button></div></form>');
}

if (!isset($_SESSION['setup_csrf'])) $_SESSION['setup_csrf'] = bin2hex(random_bytes(24));
$error = '';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    try {
        $csrf = (string) ($_POST['csrf'] ?? '');
        if (!hash_equals((string) $_SESSION['setup_csrf'], $csrf)) throw new RuntimeException('页面已过期，请刷新后重试。');

        $host = post('host', '127.0.0.1');
        $port = filter_var(post('port', '3306'), FILTER_VALIDATE_INT, ['options' => ['min_range' => 1, 'max_range' => 65535]]);
        $name = post('name');
        $user = post('user');
        $password = (string) ($_POST['password'] ?? '');

        if ($host === '' || strlen($host) > 255) throw new RuntimeException('数据库地址不正确。');
        if ($port === false) throw new RuntimeException('数据库端口不正确。');
        if (!preg_match('/^[A-Za-z0-9_$-]{1,64}$/', $name)) throw new RuntimeException('数据库名称不正确。');
        if ($user === '' || strlen($user) > 64) throw new RuntimeException('数据库用户名不正确。');
        if (!is_file(SCHEMA_PATH)) throw new RuntimeException('缺少 schema.sql，请重新上传完整发布包。');

        $pdo = new PDO(
            sprintf('mysql:host=%s;port=%d;dbname=%s;charset=utf8mb4', $host, $port, $name),
            $user,
            $password,
            [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_EMULATE_PREPARES => false],
        );

        $schema = file_get_contents(SCHEMA_PATH);
        if ($schema === false) throw new RuntimeException('无法读取数据库脚本。');
        $schema = preg_replace('/^\s*--.*$/m', '', $schema) ?? $schema;
        foreach (preg_split('/;\s*(?:\R|$)/', $schema) ?: [] as $statement) {
            if (trim($statement) !== '') $pdo->exec($statement);
        }

        $config = [
            'database' => ['host' => $host, 'port' => $port, 'name' => $name, 'user' => $user, 'password' => $password],
            'session_ttl_days' => 30,
            'max_score_per_game' => 1000000,
            'max_lines_per_game' => 10000,
        ];
        $php = "<?php\ndeclare(strict_types=1);\n\nreturn " . var_export($config, true) . ";\n";
        $handle = @fopen(CONFIG_PATH, 'x');
        if ($handle === false) throw new RuntimeException('无法创建 config.php，请把 api 目录所有者设为 www 后重试。');
        $written = false;
        try {
            if (fwrite($handle, $php) !== strlen($php)) throw new RuntimeException('写入 config.php 失败。');
            fflush($handle);
            $written = true;
        } finally {
            fclose($handle);
            if (!$written) @unlink(CONFIG_PATH);
        }
        @chmod(CONFIG_PATH, 0640);
        @unlink(KEY_PATH);
        session_regenerate_id(true);
        render('<span class="badge">SETUP COMPLETE</span><h1>配置成功</h1><div class="notice success">数据库连接、自动建表和 API 配置均已完成，安装页面现已锁定。</div><div class="actions"><a class="button" href="./health">检查接口</a><a class="button" href="../">进入游戏</a></div>');
    } catch (Throwable $exception) {
        $error = $exception instanceof PDOException ? '数据库连接或建表失败：' . $exception->getMessage() : $exception->getMessage();
    }
}

$errorHtml = $error === '' ? '' : '<div class="notice error">' . h($error) . '</div>';
$key = h($providedKey);
$csrf = h((string) $_SESSION['setup_csrf']);
$host = h(post('host', '127.0.0.1'));
$port = h(post('port', '3306'));
$name = h(post('name'));
$user = h(post('user'));

render('<span class="badge">MYSQL 5.7</span><h1>服务器快速配置</h1><p>填写宝塔创建的数据库信息。页面会测试连接、自动创建所需数据表，并生成 API 配置。</p>' . $errorHtml . '<form method="post"><input type="hidden" name="setup_key" value="' . $key . '"><input type="hidden" name="csrf" value="' . $csrf . '"><div class="grid"><label>数据库地址<input name="host" value="' . $host . '" required></label><label>端口<input name="port" inputmode="numeric" value="' . $port . '" required></label><label class="full">数据库名称<input name="name" value="' . $name . '" required autocomplete="off"></label><label class="full">数据库用户名<input name="user" value="' . $user . '" required autocomplete="username"></label><label class="full">数据库密码<input name="password" type="password" required autocomplete="new-password"></label></div><div class="notice"><small>配置成功后页面自动锁定；数据库密码不会显示在网页或日志中。</small></div><div class="actions"><button type="submit">测试并完成配置</button></div></form>');
