<?php
declare(strict_types=1);

namespace Theatre\Controllers;

use DateInterval;
use DateTimeImmutable;
use DateTimeZone;
use Theatre\Core\App;
use Theatre\Core\HttpException;
use Theatre\Core\Request;

final class AdminStatsController
{
    private readonly DateTimeZone $moscow;
    private readonly DateTimeZone $utc;

    public function __construct(private readonly App $app)
    {
        $this->moscow = new DateTimeZone('Europe/Moscow');
        $this->utc = new DateTimeZone('UTC');
    }

    public function statistics(Request $request): array
    {
        $this->guard($request);
        $today = new DateTimeImmutable('today', $this->moscow);
        $todayVisitors = $this->visitorsBetween($today, $today);
        $yesterdayVisitors = $this->visitorsBetween($today->sub(new DateInterval('P1D')), $today->sub(new DateInterval('P1D')));
        $sevenVisitors = $this->visitorsBetween($today->sub(new DateInterval('P6D')), $today);
        $previousSevenVisitors = $this->visitorsBetween($today->sub(new DateInterval('P13D')), $today->sub(new DateInterval('P7D')));
        $thirtyVisitors = $this->visitorsBetween($today->sub(new DateInterval('P29D')), $today);

        return [
            'visitors' => [
                'today' => ['value' => $todayVisitors, 'comparison' => $this->comparison($todayVisitors, $yesterdayVisitors)],
                'seven_days' => ['value' => $sevenVisitors, 'comparison' => $this->comparison($sevenVisitors, $previousSevenVisitors)],
                'thirty_days' => ['value' => $thirtyVisitors, 'comparison' => null],
            ],
            'page_views' => $this->periodMetric('page_views', 'viewed_at', $today),
            'ticket_clicks' => $this->periodMetric('ticket_clicks', 'clicked_at', $today),
            'daily' => $this->dailySeries($today->sub(new DateInterval('P29D')), $today),
        ];
    }

    public function franchiseStatistics(Request $request): array
    {
        $this->guard($request);
        $today = new DateTimeImmutable('today', $this->moscow);
        return [
            'views' => [
                'today' => $this->pageViewsBetween($today, $today, '/franchise'),
                'seven_days' => $this->pageViewsBetween($today->sub(new DateInterval('P6D')), $today, '/franchise'),
                'thirty_days' => $this->pageViewsBetween($today->sub(new DateInterval('P29D')), $today, '/franchise'),
            ],
            'daily' => $this->franchiseDailySeries($today->sub(new DateInterval('P29D')), $today),
            'applications' => [
                'total' => $this->scalar('SELECT COUNT(*) FROM franchise_applications'),
                'new' => $this->scalar("SELECT COUNT(*) FROM franchise_applications WHERE status = 'new'"),
                'processed' => $this->scalar("SELECT COUNT(*) FROM franchise_applications WHERE status = 'processed'"),
            ],
        ];
    }

    public function applications(Request $request): array
    {
        $this->guard($request);
        $status = (string) $request->query('status', 'all');
        if (!in_array($status, ['all', 'new', 'processed'], true)) {
            throw new HttpException(422, 'validation_failed', 'Некорректный статус');
        }
        if ($status === 'all') {
            $statement = $this->app->db()->pdo()->query(
                'SELECT id, name, city, phone, status, created_at, updated_at
                 FROM franchise_applications ORDER BY created_at DESC, id DESC'
            );
        } else {
            $statement = $this->app->db()->pdo()->prepare(
                'SELECT id, name, city, phone, status, created_at, updated_at
                 FROM franchise_applications WHERE status = :status ORDER BY created_at DESC, id DESC'
            );
            $statement->execute(['status' => $status]);
        }
        return array_map(static function (array $row): array {
            $row['id'] = (int) $row['id'];
            $row['created_at'] = str_replace(' ', 'T', (string) $row['created_at']) . 'Z';
            $row['updated_at'] = str_replace(' ', 'T', (string) $row['updated_at']) . 'Z';
            return $row;
        }, $statement->fetchAll());
    }

    public function updateApplicationStatus(Request $request, int $id): array
    {
        $this->guard($request);
        $status = (string) ($request->body()['status'] ?? '');
        if (!in_array($status, ['new', 'processed'], true)) {
            throw new HttpException(422, 'validation_failed', 'Некорректный статус', ['status' => 'new или processed']);
        }
        $statement = $this->app->db()->pdo()->prepare(
            'UPDATE franchise_applications SET status = :status, updated_at = UTC_TIMESTAMP() WHERE id = :id'
        );
        $statement->execute(['status' => $status, 'id' => $id]);
        if ($statement->rowCount() === 0) {
            $exists = $this->app->db()->pdo()->prepare('SELECT id FROM franchise_applications WHERE id = :id');
            $exists->execute(['id' => $id]);
            if ($exists->fetchColumn() === false) {
                throw new HttpException(404, 'not_found', 'Заявка не найдена');
            }
        }
        return ['id' => $id, 'status' => $status];
    }

    public function deleteApplication(Request $request, int $id): array
    {
        $this->guard($request);
        $statement = $this->app->db()->pdo()->prepare('DELETE FROM franchise_applications WHERE id = :id');
        $statement->execute(['id' => $id]);
        if ($statement->rowCount() === 0) {
            throw new HttpException(404, 'not_found', 'Заявка не найдена');
        }
        return ['deleted' => true];
    }

    public function newCount(Request $request): array
    {
        $this->guard($request);
        return ['count' => $this->scalar("SELECT COUNT(*) FROM franchise_applications WHERE status = 'new'")];
    }

    private function guard(Request $request): void
    {
        $admin = $this->app->auth()->requireAdmin($request->bearerToken());
        $this->app->rateLimiter()->enforce('admin-api', 'admin-' . $admin['id'], 120, 60);
    }

    private function visitorsBetween(DateTimeImmutable $start, DateTimeImmutable $end): int
    {
        $statement = $this->app->db()->pdo()->prepare(
            'SELECT COUNT(*) FROM daily_visitors WHERE visit_date BETWEEN :start AND :end'
        );
        $statement->execute(['start' => $start->format('Y-m-d'), 'end' => $end->format('Y-m-d')]);
        return (int) $statement->fetchColumn();
    }

    private function pageViewsBetween(DateTimeImmutable $start, DateTimeImmutable $end, ?string $path = null): int
    {
        [$utcStart, $utcEnd] = $this->utcRange($start, $end);
        $sql = 'SELECT COUNT(*) FROM page_views WHERE viewed_at >= :start AND viewed_at < :end';
        $parameters = ['start' => $utcStart, 'end' => $utcEnd];
        if ($path !== null) {
            $sql .= ' AND page_path = :path';
            $parameters['path'] = $path;
        }
        $statement = $this->app->db()->pdo()->prepare($sql);
        $statement->execute($parameters);
        return (int) $statement->fetchColumn();
    }

    private function metricBetween(string $table, string $column, DateTimeImmutable $start, DateTimeImmutable $end): int
    {
        if (!in_array($table . '.' . $column, ['page_views.viewed_at', 'ticket_clicks.clicked_at'], true)) {
            throw new \RuntimeException('Unsafe metric.');
        }
        [$utcStart, $utcEnd] = $this->utcRange($start, $end);
        $statement = $this->app->db()->pdo()->prepare(
            "SELECT COUNT(*) FROM {$table} WHERE {$column} >= :start AND {$column} < :end"
        );
        $statement->execute(['start' => $utcStart, 'end' => $utcEnd]);
        return (int) $statement->fetchColumn();
    }

    private function periodMetric(string $table, string $column, DateTimeImmutable $today): array
    {
        $todayValue = $this->metricBetween($table, $column, $today, $today);
        $yesterday = $today->sub(new DateInterval('P1D'));
        $yesterdayValue = $this->metricBetween($table, $column, $yesterday, $yesterday);
        $seven = $this->metricBetween($table, $column, $today->sub(new DateInterval('P6D')), $today);
        $previousSeven = $this->metricBetween($table, $column, $today->sub(new DateInterval('P13D')), $today->sub(new DateInterval('P7D')));
        return [
            'today' => ['value' => $todayValue, 'comparison' => $this->comparison($todayValue, $yesterdayValue)],
            'seven_days' => ['value' => $seven, 'comparison' => $this->comparison($seven, $previousSeven)],
            'thirty_days' => [
                'value' => $this->metricBetween($table, $column, $today->sub(new DateInterval('P29D')), $today),
                'comparison' => null,
            ],
        ];
    }

    private function dailySeries(DateTimeImmutable $start, DateTimeImmutable $end): array
    {
        $series = [];
        for ($date = $start; $date <= $end; $date = $date->add(new DateInterval('P1D'))) {
            $series[] = [
                'date' => $date->format('Y-m-d'),
                'visitors' => $this->visitorsBetween($date, $date),
                'page_views' => $this->pageViewsBetween($date, $date),
                'ticket_clicks' => $this->metricBetween('ticket_clicks', 'clicked_at', $date, $date),
            ];
        }
        return $series;
    }

    private function franchiseDailySeries(DateTimeImmutable $start, DateTimeImmutable $end): array
    {
        $series = [];
        for ($date = $start; $date <= $end; $date = $date->add(new DateInterval('P1D'))) {
            $series[] = ['date' => $date->format('Y-m-d'), 'views' => $this->pageViewsBetween($date, $date, '/franchise')];
        }
        return $series;
    }

    private function utcRange(DateTimeImmutable $start, DateTimeImmutable $end): array
    {
        $startUtc = $start->setTimezone($this->utc)->format('Y-m-d H:i:s');
        $endUtc = $end->add(new DateInterval('P1D'))->setTimezone($this->utc)->format('Y-m-d H:i:s');
        return [$startUtc, $endUtc];
    }

    private function comparison(int $current, int $previous): ?float
    {
        if ($previous === 0) {
            return $current === 0 ? 0.0 : null;
        }
        return round((($current - $previous) / $previous) * 100, 1);
    }

    private function scalar(string $sql): int
    {
        return (int) $this->app->db()->pdo()->query($sql)->fetchColumn();
    }
}

