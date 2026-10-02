<?php
declare(strict_types=1);
require dirname(__DIR__) . '/api/src/Core/HttpException.php';
require dirname(__DIR__) . '/api/src/Core/Validator.php';
require dirname(__DIR__) . '/api/src/Core/Slugger.php';
require dirname(__DIR__) . '/api/src/Core/Markdown.php';
require dirname(__DIR__) . '/api/src/Core/RateLimiter.php';
require dirname(__DIR__) . '/api/src/Core/Request.php';
use Theatre\Core\{HttpException,Validator,Slugger,Markdown,RateLimiter,Request};
$count = 0;
function check(bool $condition, string $message): void { global $count; if (!$condition) throw new RuntimeException($message); $count++; }
check(Slugger::make('Сказка о музыке') === 'skazka-o-muzyke', 'Cyrillic slug');
check(strlen(Slugger::make(str_repeat('Музыка ',100))) <= 180, 'Slug length');
$errors=[]; Validator::text(['title'=>[]],'title',2,150,$errors); check(isset($errors['title']), 'Array rejected');
$errors=[]; Validator::date(['date'=>'2026-02-30'],'date',$errors); check(isset($errors['date']), 'Invalid calendar date');
foreach (['00:00', '09:05', '18:30', '23:59'] as $time) { $errors=[]; check(Validator::time(['time'=>$time], 'time', $errors)===$time && $errors===[], 'Valid start time'); }
foreach (['24:00', '12:60', '9:00', '18:30:00', '12:00Z', 'noon', [], 1230, false] as $time) { $errors=[]; Validator::time(['time'=>$time], 'time', $errors); check(isset($errors['time']), 'Invalid start time'); }
foreach ([null, ''] as $time) { $errors=[]; check(Validator::time(['time'=>$time], 'time', $errors)===null && $errors===[], 'Unknown start time stays empty'); }
$errors=[]; Validator::url(['url'=>'javascript:alert(1)'],'url',$errors); check(isset($errors['url']), 'Unsafe URL');
foreach (['# Заголовок','* Список','<script>alert(1)</script>','[Ссылка](https://example.com)','![Фото](x)','```код```','> Цитата','|a|b|','    code'] as $value) { $errors=[]; Markdown::validate($value,'text',$errors); check(isset($errors['text']), 'Forbidden markdown: '.$value); }
$errors=[]; Markdown::validate("Абзац **жирным** и *курсивом*.\n\nВторой абзац.",'text',$errors); check($errors===[], 'Approved markdown');
$directory = sys_get_temp_dir() . '/theatre-rate-' . bin2hex(random_bytes(6));
$limiter=new RateLimiter($directory, 'test-secret');
$limiter->enforce('test','key',2,60); $limiter->enforce('test','key',2,60);
try { $limiter->enforce('test','key',2,60); check(false,'Rate limit expected'); } catch (HttpException $error) { check($error->status===429,'Rate limit status'); }
$file=glob($directory.'/*.json')[0]; $first=json_decode(file_get_contents($file),true);
try { $limiter->enforce('test','key',2,60); } catch (HttpException) {}
$second=json_decode(file_get_contents($file),true); check($first['blocked_until']===$second['blocked_until'],'Block must not extend forever');
unlink($file); rmdir($directory);
$token = str_repeat('a', 43);
$_SERVER['REDIRECT_HTTP_AUTHORIZATION'] = "Bearer {$token}";
check((new Request())->bearerToken() === $token, 'Authorization restored from Apache REDIRECT_ variable');
$_SERVER['HTTP_AUTHORIZATION'] = 'Bearer direct-token';
check((new Request())->bearerToken() === 'direct-token', 'Direct Authorization header wins');
unset($_SERVER['REDIRECT_HTTP_AUTHORIZATION'], $_SERVER['HTTP_AUTHORIZATION']);
check((new Request())->bearerToken() === null, 'Missing Authorization stays empty');
echo "Core: {$count} assertions passed.\n";
