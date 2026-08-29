<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: same-origin');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

function respond(array $payload, int $status = 200): never
{
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function fail(string $message, int $status = 400): never
{
    respond(['error' => $message], $status);
}

function config(): array
{
    static $config;
    if ($config !== null) return $config;
    $path = __DIR__ . '/config.php';
    if (!is_file($path)) throw new RuntimeException('API config.php is missing');
    $config = require $path;
    return $config;
}

function db(): PDO
{
    static $pdo;
    if ($pdo instanceof PDO) return $pdo;
    $database = config()['database'];
    $dsn = sprintf(
        'mysql:host=%s;port=%d;dbname=%s;charset=utf8mb4',
        $database['host'],
        $database['port'],
        $database['name'],
    );
    $pdo = new PDO($dsn, $database['user'], $database['password'], [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]);
    return $pdo;
}

function body(): array
{
    $length = (int) ($_SERVER['CONTENT_LENGTH'] ?? 0);
    if ($length > 32768) fail('请求内容过大', 413);
    $raw = file_get_contents('php://input');
    if ($raw === false || $raw === '') return [];
    $decoded = json_decode($raw, true);
    if (!is_array($decoded)) fail('请求格式不正确');
    return $decoded;
}

function player(array $row, ?int $currentUserId = null): array
{
    $id = (int) $row['id'];
    return [
        'id' => (string) $id,
        'username' => $row['username'],
        'bestScore' => (int) $row['best_score'],
        'totalLines' => (int) $row['total_lines'],
        'gamesPlayed' => (int) $row['games_played'],
        'isCurrent' => $currentUserId !== null && $id === $currentUserId,
    ];
}

function bearerToken(): ?string
{
    $header = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
    if (!preg_match('/^Bearer\s+([a-f0-9]{64})$/i', trim($header), $matches)) return null;
    return strtolower($matches[1]);
}

function authenticatedUser(bool $required = true): ?array
{
    $token = bearerToken();
    if ($token === null) {
        if ($required) fail('请先登录', 401);
        return null;
    }
    $tokenHash = hash('sha256', $token);
    $statement = db()->prepare(
        'SELECT u.id, u.username, u.best_score, u.total_lines, u.games_played
         FROM sessions s JOIN users u ON u.id = s.user_id
         WHERE s.token_hash = ? AND s.expires_at > NOW() LIMIT 1'
    );
    $statement->execute([$tokenHash]);
    $user = $statement->fetch();
    if (!$user) {
        if ($required) fail('登录已过期，请重新登录', 401);
        return null;
    }
    $user['_token_hash'] = $tokenHash;
    return $user;
}

function newSession(int $userId): array
{
    $token = bin2hex(random_bytes(32));
    $tokenHash = hash('sha256', $token);
    $ttlDays = max(1, min(90, (int) (config()['session_ttl_days'] ?? 30)));
    $expiresAt = (new DateTimeImmutable("+{$ttlDays} days"))->format('Y-m-d H:i:s');
    $statement = db()->prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)');
    $statement->execute([$tokenHash, $userId, $expiresAt]);
    return ['token' => $token, 'expiresInDays' => $ttlDays];
}

function validateCredentials(array $input, bool $registering): array
{
    $username = trim((string) ($input['username'] ?? ''));
    $password = (string) ($input['password'] ?? '');
    $usernameLength = function_exists('mb_strlen')
        ? mb_strlen($username, 'UTF-8')
        : preg_match_all('/./u', $username, $unused);
    if ($usernameLength < 2 || $usernameLength > 12 || preg_match('/[\x00-\x1F\x7F]/u', $username)) {
        fail('昵称需要 2–12 个有效字符');
    }
    $minimum = $registering ? 8 : 1;
    if (strlen($password) < $minimum || strlen($password) > 72) {
        fail($registering ? '密码需要 8–72 位' : '昵称或密码不正确');
    }
    return [$username, $password];
}

function leaderboard(?array $currentUser, int $limit): array
{
    $limit = max(1, min(100, $limit));
    $statement = db()->prepare(
        'SELECT id, username, best_score, total_lines, games_played
         FROM users ORDER BY best_score DESC, total_lines DESC, created_at ASC LIMIT ?'
    );
    $statement->bindValue(1, $limit, PDO::PARAM_INT);
    $statement->execute();
    $currentId = $currentUser ? (int) $currentUser['id'] : null;
    $players = array_map(fn(array $row) => player($row, $currentId), $statement->fetchAll());
    $currentRank = null;
    if ($currentUser) {
        $rankStatement = db()->prepare('SELECT 1 + COUNT(*) FROM users WHERE best_score > ?');
        $rankStatement->execute([(int) $currentUser['best_score']]);
        $currentRank = (int) $rankStatement->fetchColumn();
    }
    return ['players' => $players, 'currentRank' => $currentRank];
}

function nextStartScore(int $userId): int
{
    $statement = db()->prepare(
        'SELECT start_score FROM one_time_game_bonuses WHERE user_id = ? AND claimed_game_id IS NULL LIMIT 1'
    );
    $statement->execute([$userId]);
    $score = $statement->fetchColumn();
    return is_numeric($score) ? (int) $score : 0;
}

function validCounter(mixed $value, int $maximum = 1000000): bool
{
    return is_int($value) && $value >= 0 && $value <= $maximum;
}

function validBoard(mixed $board): bool
{
    if (!is_array($board) || count($board) !== 10) return false;
    foreach ($board as $row) {
        if (!is_array($row) || count($row) !== 10) return false;
        foreach ($row as $cell) {
            if (!is_int($cell) || $cell < 0 || $cell > 7) return false;
        }
    }
    return true;
}

function validCandidates(mixed $candidates): bool
{
    if (!is_array($candidates) || count($candidates) !== 3) return false;
    foreach ($candidates as $piece) {
        if ($piece === null) continue;
        if (!is_array($piece) || !is_string($piece['id'] ?? null) || strlen($piece['id']) > 100) return false;
        if (!validCounter($piece['color'] ?? null, 7) || ($piece['color'] ?? 0) < 1) return false;
        if (!validCounter($piece['width'] ?? null, 10) || ($piece['width'] ?? 0) < 1) return false;
        if (!validCounter($piece['height'] ?? null, 10) || ($piece['height'] ?? 0) < 1) return false;
        if (!is_array($piece['cells'] ?? null) || count($piece['cells']) < 1 || count($piece['cells']) > 100) return false;
    }
    return true;
}

function validateGameSave(mixed $save): array
{
    if (!is_array($save) || ($save['version'] ?? null) !== 1 || ($save['status'] ?? null) !== 'running') {
        fail('对局存档格式不正确');
    }
    if (!validBoard($save['board'] ?? null) || !validCandidates($save['candidates'] ?? null)) {
        fail('对局棋盘格式不正确');
    }
    foreach (['savedAt', 'score', 'lines', 'combo', 'placementsInBatch'] as $field) {
        if (!validCounter($save[$field] ?? null, $field === 'savedAt' ? PHP_INT_MAX : 1000000)) {
            fail('对局进度格式不正确');
        }
    }
    if (($save['placementsInBatch'] ?? 4) > 3) fail('对局进度格式不正确');
    $history = $save['history'] ?? null;
    if ($history !== null) {
        if (!is_array($history) || !validBoard($history['board'] ?? null) || !validCandidates($history['candidates'] ?? null)) {
            fail('撤回存档格式不正确');
        }
        foreach (['score', 'lines', 'combo', 'placementsInBatch'] as $field) {
            if (!validCounter($history[$field] ?? null) || ($field === 'placementsInBatch' && $history[$field] > 3)) {
                fail('撤回存档格式不正确');
            }
        }
    }
    return $save;
}

try {
    $method = $_SERVER['REQUEST_METHOD'];
    $path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH) ?: '/';
    $path = preg_replace('#^/api#', '', $path) ?: '/';

    if ($method === 'GET' && $path === '/health') {
        db()->query('SELECT 1');
        respond(['ok' => true, 'service' => 'tuotuo-blocks-api']);
    }

    if ($method === 'POST' && $path === '/register') {
        [$username, $password] = validateCredentials(body(), true);
        $passwordHash = password_hash($password, PASSWORD_DEFAULT);
        try {
            $statement = db()->prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)');
            $statement->execute([$username, $passwordHash]);
        } catch (PDOException $error) {
            if ($error->getCode() === '23000') fail('这个昵称已经被注册啦', 409);
            throw $error;
        }
        $userId = (int) db()->lastInsertId();
        $session = newSession($userId);
        $user = ['id' => $userId, 'username' => $username, 'best_score' => 0, 'total_lines' => 0, 'games_played' => 0];
        respond([
            'session' => ['id' => (string) $userId, 'username' => $username],
            'player' => player($user, $userId),
            'startBonus' => nextStartScore($userId),
        ] + $session, 201);
    }

    if ($method === 'POST' && $path === '/login') {
        [$username, $password] = validateCredentials(body(), false);
        $statement = db()->prepare(
            'SELECT id, username, password_hash, best_score, total_lines, games_played FROM users WHERE username = ? LIMIT 1'
        );
        $statement->execute([$username]);
        $user = $statement->fetch();
        if (!$user || !password_verify($password, $user['password_hash'])) fail('昵称或密码不正确', 401);
        if (password_needs_rehash($user['password_hash'], PASSWORD_DEFAULT)) {
            $rehash = db()->prepare('UPDATE users SET password_hash = ? WHERE id = ?');
            $rehash->execute([password_hash($password, PASSWORD_DEFAULT), $user['id']]);
        }
        $session = newSession((int) $user['id']);
        respond([
            'session' => ['id' => (string) $user['id'], 'username' => $user['username']],
            'player' => player($user, (int) $user['id']),
            'startBonus' => nextStartScore((int) $user['id']),
        ] + $session);
    }

    if ($method === 'POST' && $path === '/logout') {
        $user = authenticatedUser();
        $statement = db()->prepare('DELETE FROM sessions WHERE token_hash = ?');
        $statement->execute([$user['_token_hash']]);
        respond(['ok' => true]);
    }

    if ($method === 'GET' && $path === '/me') {
        $user = authenticatedUser();
        respond([
            'session' => ['id' => (string) $user['id'], 'username' => $user['username']],
            'player' => player($user, (int) $user['id']),
            'startBonus' => nextStartScore((int) $user['id']),
        ]);
    }

    if ($method === 'GET' && $path === '/leaderboard') {
        $user = authenticatedUser(false);
        respond(leaderboard($user, (int) ($_GET['limit'] ?? 20)));
    }

    if ($method === 'POST' && $path === '/game-start') {
        $user = authenticatedUser();
        $gameId = strtolower(trim((string) (body()['gameId'] ?? '')));
        if (!preg_match('/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/', $gameId)) {
            fail('开局标识格式不正确');
        }

        $pdo = db();
        $pdo->beginTransaction();
        try {
            $statement = $pdo->prepare(
                'SELECT start_score, claimed_game_id FROM one_time_game_bonuses WHERE user_id = ? FOR UPDATE'
            );
            $statement->execute([$user['id']]);
            $bonus = $statement->fetch();
            $initialScore = 0;
            if ($bonus && $bonus['claimed_game_id'] === null) {
                $claim = $pdo->prepare(
                    'UPDATE one_time_game_bonuses SET claimed_game_id = ?, claimed_at = NOW() WHERE user_id = ? AND claimed_game_id IS NULL'
                );
                $claim->execute([$gameId, $user['id']]);
                if ($claim->rowCount() === 1) $initialScore = (int) $bonus['start_score'];
            } elseif ($bonus && hash_equals((string) $bonus['claimed_game_id'], $gameId)) {
                $initialScore = (int) $bonus['start_score'];
            }
            $pdo->commit();
        } catch (Throwable $error) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            throw $error;
        }
        respond(['initialScore' => $initialScore, 'randomBoard' => $initialScore > 0]);
    }

    if ($method === 'GET' && $path === '/game-save') {
        $user = authenticatedUser();
        $statement = db()->prepare('SELECT state_json FROM active_game_saves WHERE user_id = ? LIMIT 1');
        $statement->execute([$user['id']]);
        $json = $statement->fetchColumn();
        if (!is_string($json)) respond(['save' => null]);
        $save = json_decode($json, true);
        if (!is_array($save)) {
            $delete = db()->prepare('DELETE FROM active_game_saves WHERE user_id = ?');
            $delete->execute([$user['id']]);
            respond(['save' => null]);
        }
        respond(['save' => $save]);
    }

    if ($method === 'PUT' && $path === '/game-save') {
        $user = authenticatedUser();
        $save = validateGameSave(body()['save'] ?? null);
        $json = json_encode($save, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        if (!is_string($json) || strlen($json) > 30000) fail('对局存档过大', 413);
        $statement = db()->prepare(
            'INSERT INTO active_game_saves (user_id, state_json) VALUES (?, ?)
             ON DUPLICATE KEY UPDATE state_json = VALUES(state_json), updated_at = CURRENT_TIMESTAMP'
        );
        $statement->execute([$user['id'], $json]);
        respond(['ok' => true]);
    }

    if ($method === 'DELETE' && $path === '/game-save') {
        $user = authenticatedUser();
        $statement = db()->prepare('DELETE FROM active_game_saves WHERE user_id = ?');
        $statement->execute([$user['id']]);
        respond(['ok' => true]);
    }

    if ($method === 'POST' && $path === '/scores') {
        $user = authenticatedUser();
        $input = body();
        $score = $input['score'] ?? null;
        $lines = $input['lines'] ?? null;
        if (!is_int($score) || !is_int($lines)) fail('成绩格式不正确');
        $maxScore = (int) (config()['max_score_per_game'] ?? 1000000);
        $maxLines = (int) (config()['max_lines_per_game'] ?? 10000);
        if ($score < 0 || $score > $maxScore || $lines < 0 || $lines > $maxLines) fail('成绩超出允许范围');

        $pdo = db();
        $pdo->beginTransaction();
        try {
            $insert = $pdo->prepare('INSERT INTO score_submissions (user_id, score, lines_cleared) VALUES (?, ?, ?)');
            $insert->execute([$user['id'], $score, $lines]);
            $update = $pdo->prepare(
                'UPDATE users SET best_score = GREATEST(best_score, ?), total_lines = total_lines + ?, games_played = games_played + 1 WHERE id = ?'
            );
            $update->execute([$score, $lines, $user['id']]);
            $pdo->commit();
        } catch (Throwable $error) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            throw $error;
        }
        $statement = $pdo->prepare('SELECT id, username, best_score, total_lines, games_played FROM users WHERE id = ?');
        $statement->execute([$user['id']]);
        respond(['player' => player($statement->fetch(), (int) $user['id'])]);
    }

    fail('接口不存在', 404);
} catch (Throwable $error) {
    error_log('[tuotuo-blocks-api] ' . $error->getMessage());
    fail('服务器暂时不可用，请稍后重试', 500);
}
