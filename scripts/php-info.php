<?php
if (PHP_SAPI !== 'cli') exit(1);
echo PHP_VERSION, PHP_EOL, implode(', ', get_loaded_extensions()), PHP_EOL;
foreach (['upload_max_filesize', 'post_max_size', 'memory_limit'] as $key) echo $key, '=', ini_get($key), PHP_EOL;
