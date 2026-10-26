<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * The impersonation detector asks, every minute, for the accounts first seen inside a time window
     * (PRD §10.7: the last 24 hours). Without this index that is a scan of every account ever imported.
     */
    public function up(): void
    {
        Schema::table('accounts', function (Blueprint $table) {
            $table->index('first_seen_at', 'accounts_first_seen_at_idx');
        });
    }

    public function down(): void
    {
        Schema::table('accounts', function (Blueprint $table) {
            $table->dropIndex('accounts_first_seen_at_idx');
        });
    }
};
