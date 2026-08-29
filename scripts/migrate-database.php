<?php
declare(strict_types=1);

[$script, $configPath, $schemaPath] = array_pad($argv, 3, '');
if (!is_file($configPath) || !is_file($schemaPath)) {
    fwrite(STDERR, "数据库迁移失败：缺少 config.php 或 schema.sql。\n");
    exit(1);
}

$config = require $configPath;
$database = $config['database'] ?? null;
if (!is_array($database)) {
    fwrite(STDERR, "数据库迁移失败：配置格式不正确。\n");
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
    $schema = file_get_contents($schemaPath);
    if ($schema === false) throw new RuntimeException('无法读取 schema.sql');
    $schema = preg_replace('/^\s*--.*$/m', '', $schema) ?? $schema;
    foreach (preg_split('/;\s*(?:\R|$)/', $schema) ?: [] as $statement) {
        if (trim($statement) !== '') $pdo->exec($statement);
    }
    echo "数据库表已更新。\n";
} catch (Throwable $error) {
    fwrite(STDERR, "数据库迁移失败：{$error->getMessage()}\n");
    exit(1);
}
