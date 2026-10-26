<?php

namespace Tests\Concerns;

use App\Models\ReplayScenario;
use App\Models\User;
use App\Services\Ingest\ReplayScenarioImporter;

trait BuildsReplayScenarios
{
    protected const SCENARIO_HEADER = 'offset_seconds,phase,text,account_handle,account_display_name,account_age_days,label_manual';

    /**
     * @param  list<string>  $lines  CSV lines without the header
     */
    protected function scenarioCsv(array $lines): string
    {
        return implode("\n", [self::SCENARIO_HEADER, ...$lines]);
    }

    /** A small valid script: two baseline posts, then four incident posts, three of them in one virtual minute. */
    protected function smallScenarioCsv(): string
    {
        return $this->scenarioCsv([
            '0,baseline,Pelayanan loket institusi contoh cepat sekali,@warga_a,Warga A,400,organic',
            '1800,baseline,Antrean institusi contoh pagi tadi panjang,@warga_b,,500,organic',
            '3600,incident,Waspada kabar penting institusi contoh kode A1,@kampanye_1,,3,anomalous',
            '3610,incident,Waspada kabar penting institusi contoh kode B2,@kampanye_2,,4,anomalous',
            '3620,incident,Jadwal institusi contoh minggu ini berubah,@warga_a,,400,organic',
            '3700,incident,Waspada kabar penting institusi contoh kode C3,@kampanye_3,,5,anomalous',
        ]);
    }

    protected function importScenario(string $csv, array $meta = [], ?User $user = null): ReplayScenario
    {
        $path = tempnam(sys_get_temp_dir(), 'scn');
        file_put_contents($path, $csv);

        try {
            return app(ReplayScenarioImporter::class)->import(
                $path,
                $meta + ['name' => 'Skenario uji'],
                $user ?? User::factory()->role('admin')->create(),
            );
        } finally {
            @unlink($path);
        }
    }
}
