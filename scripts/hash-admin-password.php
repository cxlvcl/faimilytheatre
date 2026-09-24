<?php
declare(strict_types=1);

// Local helper: reads a password from stdin and outputs only its PHP hash.
// It never connects to a database or changes an account.
if (PHP_SAPI !== 'cli') exit(1);
$password = stream_get_contents(STDIN, 1024);
if ($password === false || strlen($password) < 16 || strlen($password) > 72 || str_contains($password, "\0") || str_contains($password, "\n") || str_contains($password, "\r")) {
    fwrite(STDERR, "Use a password of 16–72 bytes, without line breaks. No account was changed.\n");
    exit(1);
}
echo password_hash($password, PASSWORD_DEFAULT), "\n";
