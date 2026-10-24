<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Setting;
use App\Services\Audit\AuditLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Validator as ValidatorInstance;

/**
 * Detection settings (PRD §9.6, §11, F15). Every rule below is explained in docs/DETECTION_SETTINGS.md.
 */
class SettingController extends Controller
{
    private const KEY = 'detection';

    public function __construct(private AuditLogger $audit) {}

    public function showDetectionSettings(): JsonResponse
    {
        return $this->payload(Setting::with('updatedBy:id,name')->find(self::KEY));
    }

    public function updateDetectionSettings(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), $this->rules());
        $validator->after(fn (ValidatorInstance $v) => $this->validateRelations($v));
        $value = $this->normalize($validator->validate());

        $current = Setting::detection();
        $changes = $this->diff($current, $value);

        // Nothing changed: no write and no audit row.
        if ($changes === []) {
            return $this->payload(Setting::with('updatedBy:id,name')->find(self::KEY));
        }

        // `audit_logs.object_id` is a bigint and the settings key is a string, so the key goes in `detail`.
        $setting = DB::transaction(function () use ($request, $value, $changes) {
            $setting = Setting::updateOrCreate(
                ['key' => self::KEY],
                ['value' => $value, 'updated_by' => $request->user()->id],
            );
            $this->audit->log('settings.update', null, ['key' => self::KEY, 'changes' => $changes]);

            return $setting;
        });

        return $this->payload($setting->load('updatedBy:id,name'));
    }

    /**
     * @return array<string, array<int, mixed>|string>
     */
    private function rules(): array
    {
        return [
            'coordination_window_minutes' => 'required|integer:strict|between:1,180',
            'z_threshold' => 'required|numeric:strict|between:2,10',
            'min_volume' => 'required|integer:strict|between:1,10000',
            'baseline_hours' => 'required|integer:strict|between:24,720',
            'min_baseline_hours' => 'required|integer:strict|between:1,720',
            'similarity_threshold' => 'required|numeric:strict|between:0.3,1',
            'min_accounts_cluster' => 'required|integer:strict|between:2,1000',
            'young_account_days' => 'required|integer:strict|between:1,365',
            'impersonation_threshold' => 'required|numeric:strict|between:0.3,1',
            'weights' => 'required|array',
            'weights.spike' => 'required|integer:strict|between:0,100',
            'weights.anomaly' => 'required|integer:strict|between:0,100',
            'weights.sentiment' => 'required|integer:strict|between:0,100',
            'weights.reach' => 'required|integer:strict|between:0,100',
            'severity_cutoffs' => 'required|array',
            'severity_cutoffs.medium' => 'required|integer:strict|between:0,100',
            'severity_cutoffs.high' => 'required|integer:strict|between:0,100',
            'sensitivity_z_offset' => 'required|array',
            'sensitivity_z_offset.low' => 'required|numeric:strict|between:-3,3',
            'sensitivity_z_offset.medium' => 'required|numeric:strict|between:-3,3',
            'sensitivity_z_offset.high' => 'required|numeric:strict|between:-3,3',
        ];
    }

    /**
     * Rules that compare fields with each other. Skipped while a single field is still invalid.
     */
    private function validateRelations(ValidatorInstance $validator): void
    {
        if ($validator->errors()->isNotEmpty()) {
            return;
        }

        $data = $validator->getData();

        if (array_sum(Arr::only($data['weights'], ['spike', 'anomaly', 'sentiment', 'reach'])) !== 100) {
            $validator->errors()->add('weights', 'The weights must add up to exactly 100.');
        }
        if ($data['severity_cutoffs']['medium'] >= $data['severity_cutoffs']['high']) {
            $validator->errors()->add('severity_cutoffs.medium', 'The medium cutoff must be lower than the high cutoff.');
        }
        if ($data['min_baseline_hours'] > $data['baseline_hours']) {
            $validator->errors()->add('min_baseline_hours', 'The minimum baseline cannot exceed the baseline window.');
        }
        $offset = $data['sensitivity_z_offset'];
        if (! ($offset['low'] >= $offset['medium'] && $offset['medium'] >= $offset['high'])) {
            $validator->errors()->add('sensitivity_z_offset', 'Offsets must satisfy low >= medium >= high.');
        }
    }

    /**
     * Whitelist and cast to the stored shape, in the same key order as the defaults. Unknown keys are dropped.
     *
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    private function normalize(array $data): array
    {
        $value = [];
        foreach (Setting::DETECTION_DEFAULTS as $key => $default) {
            if (is_array($default)) {
                foreach ($default as $name => $inner) {
                    $value[$key][$name] = $this->cast($inner, $data[$key][$name]);
                }
            } else {
                $value[$key] = $this->cast($default, $data[$key]);
            }
        }

        return $value;
    }

    private function cast(int|float $like, int|float $input): int|float
    {
        return is_int($like) ? (int) $input : (float) $input;
    }

    /**
     * Changed leaves as {"weights.spike": {"from": 40, "to": 35}}.
     *
     * @param  array<string, mixed>  $old
     * @param  array<string, mixed>  $new
     * @return array<string, array{from: mixed, to: mixed}>
     */
    private function diff(array $old, array $new): array
    {
        $old = Arr::dot($old);
        $changes = [];
        foreach (Arr::dot($new) as $key => $to) {
            $from = $old[$key] ?? null;
            if ($from != $to) {
                $changes[$key] = ['from' => $from, 'to' => $to];
            }
        }

        return $changes;
    }

    private function payload(?Setting $setting): JsonResponse
    {
        return response()->json(['data' => [
            'key' => self::KEY,
            'value' => Setting::detection(),
            'updated_at' => $setting?->updated_at,
            'updated_by' => $setting?->updatedBy?->only(['id', 'name']),
        ]]);
    }
}
