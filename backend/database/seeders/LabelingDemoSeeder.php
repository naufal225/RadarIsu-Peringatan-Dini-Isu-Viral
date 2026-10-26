<?php

namespace Database\Seeders;

use App\Http\Controllers\Api\V1\LabelingController;
use App\Models\Source;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use RuntimeException;

/**
 * Demo labels for F14-a. It is NOT part of DatabaseSeeder: run it after CoordinationDemoSeeder,
 *
 *   php artisan db:seed --class=CoordinationDemoSeeder
 *   php artisan db:seed --class=LabelingDemoSeeder
 *
 * The newest 200 posts of the coordination demo get a manual label: posts of the campaign accounts are
 * `anomalous`, the rest `organic`. Running it again gives the same labels (it only sets the column).
 */
class LabelingDemoSeeder extends Seeder
{
    public function run(): void
    {
        $source = Source::where('name', CoordinationDemoSeeder::SOURCE_NAME)->first()
            ?? throw new RuntimeException('Run CoordinationDemoSeeder first: there are no demo posts to label.');

        $ids = DB::table('posts')->where('source_id', $source->id)
            ->orderByDesc('posted_at')->orderByDesc('id')->limit(LabelingController::TARGET_LABELED)->pluck('id');

        foreach ($ids->chunk(500) as $chunk) {
            DB::table('posts')->whereIn('id', $chunk)->update([
                'label_manual' => DB::raw("CASE WHEN account_id IN (SELECT id FROM accounts WHERE handle LIKE '@demo\_koordinasi\_%') THEN 'anomalous' ELSE 'organic' END"),
            ]);
        }

        $this->command?->info("Labeled {$ids->count()} demo posts.");
    }
}
