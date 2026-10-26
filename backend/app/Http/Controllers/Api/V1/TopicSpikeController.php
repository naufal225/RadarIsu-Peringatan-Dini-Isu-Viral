<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\SpikeBaselineRequest;
use App\Models\Setting;
use App\Models\Topic;
use App\Services\Detection\DataClock;
use App\Services\Detection\SpikeDetectionService;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

/**
 * Data behind the spike chart of a topic (F3): hourly volume, and the baseline and threshold the spike
 * detector would hold the topic to right now. Read-only; it shows the numbers behind an alert, and
 * never exposes an alert, so it carries no role-specific data beyond `topics.view`.
 */
class TopicSpikeController extends Controller
{
    public function __invoke(SpikeBaselineRequest $request, Topic $topic, SpikeDetectionService $spikes): JsonResponse
    {
        $settings = Setting::detection();
        $now = DataClock::now();
        $hourStart = $now->startOfHour();
        $firstHour = $hourStart->subHours($request->hours() - 1);

        $volumes = DB::table('metrics_hourly')->where('topic_id', $topic->id)
            ->where('hour', '>=', $firstHour)->where('hour', '<=', $hourStart)
            ->pluck('volume', 'hour');
        $byHour = [];
        foreach ($volumes as $hour => $volume) {
            $byHour[CarbonImmutable::parse($hour)->getTimestamp()] = (int) $volume;
        }

        // The running hour is partial, so the chart marks it; its volume is not the spike's `current`.
        $series = [];
        for ($at = $firstHour; $at <= $hourStart; $at = $at->addHour()) {
            $series[] = [
                'hour' => $at->toIso8601ZuluString(),
                'volume' => $byHour[$at->getTimestamp()] ?? 0,
                'is_running_hour' => $at->equalTo($hourStart),
            ];
        }

        $snapshot = $spikes->snapshots(collect([$topic]), $now, $settings)[$topic->id];

        return response()->json(['data' => [
            'topic_id' => $topic->id,
            'as_of' => $now->toIso8601ZuluString(),
            'spike' => $snapshot['spike'],
            'series' => $series,
        ]]);
    }
}
