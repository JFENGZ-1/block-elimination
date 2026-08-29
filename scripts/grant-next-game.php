<?php
declare(strict_types=1);

[$script, $configPath, $username, $scoreInput] = array_pad($argv, 4, '');
$score = filter_var($scoreInput, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1, 'max_range' => 1000000]]);
if (!is_file($configPath) || $username === '' || $score === false) {
    fwrite(STDERR, "用法：php grant-next-game.php <config.php> <账号> <初始分数>\n");
    exit(1);
}

$config = require $configPath;
$database = $config['database'] ?? null;
if (!is_array($database)) {
    fwrite(STDERR, "一次性奖励设置失败：数据库配置不正确。\n");
    exit(1);
}

try {
    $pdo = new PDO(
        sprintf(
            'mysql:host=%s;port=%d;dbname=%s;charset=utf8mb4',
            $database['host'],
            $database['port'],
            $database['name'],
        ),
        $database['user'],
        $database['password'],
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_EMULATE_PREPARES => false],
    );
    $lookup = $pdo->prepare('SELECT id FROM users WHERE username = ? LIMIT 1');
    $lookup->execute([$username]);
    $userId = $lookup->fetchColumn();
    if (!is_numeric($userId)) throw new RuntimeException('没有找到这个账号');
    $statement = $pdo->prepare(
        'INSERT INTO one_time_game_bonuses (user_id, start_score, claimed_game_id, claimed_at) VALUES (?, ?, NULL, NULL)
         ON DUPLICATE KEY UPDATE start_score = VALUES(start_score), claimed_game_id = NULL, claimed_at = NULL'
    );
    $statement->execute([(int) $userId, $score]);
    echo "已设置：{$username} 下一局 {$score} 分并使用随机棋盘，仅生效一次。\n";
} catch (Throwable $error) {
    fwrite(STDERR, "一次性奖励设置失败：{$error->getMessage()}\n");
    exit(1);
}
