<?php

namespace App\Providers;

use App\Services\Detection\AccountNameNormalizer;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;
use Illuminate\Support\Str;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        // Built from config/impersonation.php (F13); the container cannot guess an array argument.
        $this->app->bind(AccountNameNormalizer::class, fn () => AccountNameNormalizer::fromConfig());
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        // PRD §11, §13: 5 login attempts per minute per IP + email.
        RateLimiter::for('login', fn (Request $request) => Limit::perMinute(5)->by(
            Str::lower((string) $request->input('email')).'|'.$request->ip()
        ));
    }
}
