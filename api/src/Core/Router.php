<?php
declare(strict_types=1);

namespace Theatre\Core;

final class Router
{
    private array $routes = [];

    public function get(string $pattern, callable $handler): void
    {
        $this->add('GET', $pattern, $handler);
    }

    public function post(string $pattern, callable $handler): void
    {
        $this->add('POST', $pattern, $handler);
    }

    public function put(string $pattern, callable $handler): void
    {
        $this->add('PUT', $pattern, $handler);
    }

    public function patch(string $pattern, callable $handler): void
    {
        $this->add('PATCH', $pattern, $handler);
    }

    public function delete(string $pattern, callable $handler): void
    {
        $this->add('DELETE', $pattern, $handler);
    }

    public function dispatch(Request $request): mixed
    {
        $method = $request->method();
        $path = $request->path();
        foreach ($this->routes as $route) {
            if ($route['method'] !== $method) {
                continue;
            }
            if (preg_match($route['regex'], $path, $matches) !== 1) {
                continue;
            }
            $parameters = [];
            foreach ($route['parameters'] as $parameter) {
                $parameters[] = $matches[$parameter];
            }
            return ($route['handler'])($request, ...$parameters);
        }
        throw new HttpException(404, 'not_found', 'Ресурс не найден');
    }

    private function add(string $method, string $pattern, callable $handler): void
    {
        $parameters = [];
        $quoted = preg_replace_callback('/\{([a-zA-Z_][a-zA-Z0-9_]*)\}/', static function (array $matches) use (&$parameters): string {
            $parameters[] = $matches[1];
            return '(?P<' . $matches[1] . '>[^/]+)';
        }, rtrim($pattern, '/'));
        $this->routes[] = [
            'method' => $method,
            'regex' => '#^' . ($quoted === '' ? '/' : $quoted) . '$#',
            'parameters' => $parameters,
            'handler' => $handler,
        ];
    }
}

