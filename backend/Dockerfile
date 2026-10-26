FROM php:8.3-fpm-alpine

# intl: Unicode NFKC folding of account names for impersonation detection (F13, AccountNameNormalizer).
RUN apk add --no-cache postgresql-libs icu-libs \
    && apk add --no-cache --virtual .build-deps postgresql-dev icu-dev $PHPIZE_DEPS \
    && docker-php-ext-install pdo_pgsql pcntl intl \
    && apk del .build-deps

COPY --from=composer:2 /usr/bin/composer /usr/bin/composer
COPY docker/php.ini /usr/local/etc/php/conf.d/radarisu.ini

WORKDIR /var/www/html

COPY composer.json composer.lock ./
RUN composer install --no-dev --no-scripts --no-autoloader --prefer-dist --no-interaction

COPY . .
RUN composer dump-autoload --optimize --no-dev \
    && php artisan package:discover --ansi \
    && chown -R www-data:www-data storage bootstrap/cache

USER www-data

EXPOSE 9000
CMD ["php-fpm"]
