<?php

namespace App\Services\Briefings;

use App\Models\Alert;
use App\Models\Briefing;

/**
 * Pure PHP institutional PDF generator (PRD §6.1 F9, §11.8).
 * Generates standards-compliant PDF-1.4 documents without external dependencies.
 */
class BriefingPdfGenerator
{
    public function generate(Alert $alert, Briefing $briefing): string
    {
        $topicName = $alert->topic?->name ?? $alert->subjectAccount?->handle ?? "Isu #{$alert->id}";
        $kindLabel = $alert->kind === 'impersonation' ? 'Peniruan Akun Pejabat/Satuan' : 'Lonjakan & Anomali Isu Publik';
        $severityLabel = strtoupper($alert->severity);
        $score = $alert->score;
        $dateStr = now()->format('Y-m-d H:i:s') . ' UTC';
        $recommendation = $alert->recommendation ?: 'Belum ada rekomendasi tertulis.';
        $analystName = $briefing->creator?->name ?? 'Analis Siber';

        $lines = [];
        // Header Banner
        $lines[] = 'q 0.12 0.22 0.42 rg 40 780 515 42 re f Q';
        $lines[] = 'BT /F2 15 Tf 1 1 1 rg 55 798 Td (RADARISU - LEMBAR BRIEFING INTELIJEN SIBER) Tj ET';
        $lines[] = 'BT /F1 9 Tf 1 1 1 rg 55 786 Td (PERLINDUNGAN RUANG SIBER SOSIAL - DOKUMEN INTERNAL TERBATAS) Tj ET';

        // Document Metadata Box
        $lines[] = 'q 0.96 0.96 0.96 rg 40 705 515 65 re f Q';
        $lines[] = 'q 0.8 0.8 0.8 RG 40 705 515 65 re S Q';
        $lines[] = "BT /F2 10 Tf 0 0 0 rg 50 752 Td (Nomor Dokumen:) Tj /F1 10 Tf 100 0 Td (BRF-ALT-{$alert->id}-".date('Ymd').") Tj ET";
        $lines[] = "BT /F2 10 Tf 0 0 0 rg 50 737 Td (Waktu Terbit:) Tj /F1 10 Tf 100 0 Td ({$dateStr}) Tj ET";
        $lines[] = 'BT /F2 10 Tf 0 0 0 rg 50 722 Td (Penyusun:) Tj /F1 10 Tf 100 0 Td ('.$this->escape($analystName).') Tj ET';
        $lines[] = 'BT /F2 10 Tf 0 0 0 rg 50 707 Td (Status Saat Ini:) Tj /F1 10 Tf 100 0 Td ('.strtoupper($alert->status).') Tj ET';

        // Threat Assessment Box
        $boxColor = match ($alert->severity) {
            'high' => '0.96 0.88 0.88 rg 0.8 0.2 0.2 RG',
            'medium' => '0.98 0.93 0.86 rg 0.85 0.5 0.1 RG',
            default => '0.88 0.95 0.88 rg 0.2 0.6 0.2 RG',
        };
        $lines[] = "q {$boxColor} 40 615 515 80 re B Q";
        $lines[] = 'BT /F2 11 Tf 0 0 0 rg 50 675 Td (PENILAIAN ANCAMAN DAN SASARAN PANTAUAN) Tj ET';
        $lines[] = 'BT /F2 10 Tf 0 0 0 rg 50 655 Td (Target / Isu:) Tj /F1 10 Tf 100 0 Td ('.$this->escape($topicName).') Tj ET';
        $lines[] = 'BT /F2 10 Tf 0 0 0 rg 50 640 Td (Jenis Sinyal:) Tj /F1 10 Tf 100 0 Td ('.$this->escape($kindLabel).') Tj ET';
        $lines[] = "BT /F2 10 Tf 0 0 0 rg 50 625 Td (Tingkat Bahaya:) Tj /F2 10 Tf 100 0 Td ({$severityLabel} - SKOR {$score}/100) Tj ET";

        // Score Breakdown
        $lines[] = 'BT /F2 11 Tf 0 0 0 rg 40 595 Td (RINCIAN BOBOT INDIKATOR ANCAMAN) Tj ET';
        $lines[] = 'q 0.94 0.94 0.94 rg 40 540 515 45 re f Q';
        $lines[] = 'q 0.75 0.75 0.75 RG 40 540 515 45 re S Q';

        $spikeVal = $alert->score_breakdown['spike']['value'] ?? '-';
        $anomalyVal = $alert->score_breakdown['anomaly']['value'] ?? '-';
        $sentimentVal = $alert->score_breakdown['sentiment']['value'] ?? '-';
        $reachVal = $alert->score_breakdown['reach']['value'] ?? '-';

        $lines[] = "BT /F1 9 Tf 0 0 0 rg 50 568 Td (Lonjakan Z-Score: {$spikeVal} pts) Tj 130 0 Td (Koordinasi Akun: {$anomalyVal} pts) Tj 130 0 Td (Sentimen Negatif: {$sentimentVal} pts) Tj 130 0 Td (Jangkauan: {$reachVal} pts) Tj ET";
        $lines[] = 'BT /F1 8 Tf 0.35 0.35 0.35 rg 50 550 Td (*Seluruh indikator dinilai secara deterministik tanpa panggilan ke AI eksternal atau pihak ketiga.) Tj ET';

        // Recommendation
        $lines[] = 'BT /F2 11 Tf 0 0 0 rg 40 515 Td (REKOMENDASI TINDAKAN INSTITUSIONAL) Tj ET';
        $lines[] = 'q 0.98 0.98 0.98 rg 40 435 515 70 re f Q';
        $lines[] = 'q 0.8 0.8 0.8 RG 40 435 515 70 re S Q';

        $recWrapped = $this->wrapText($recommendation, 75);
        $y = 485;
        foreach (array_slice($recWrapped, 0, 4) as $recLine) {
            $lines[] = "BT /F1 9 Tf 0 0 0 rg 50 {$y} Td (".$this->escape($recLine).') Tj ET';
            $y -= 14;
        }

        // Evidence Summary
        $lines[] = 'BT /F2 11 Tf 0 0 0 rg 40 410 Td (RINGKASAN BUKTI ANOMALI TERPILIH) Tj ET';
        $lines[] = 'q 0.98 0.98 0.98 rg 40 270 515 130 re f Q';
        $lines[] = 'q 0.8 0.8 0.8 RG 40 270 515 130 re S Q';

        $evY = 380;
        $evList = $alert->evidence ? $alert->evidence->take(5) : collect();
        if ($evList->isEmpty()) {
            $lines[] = "BT /F1 9 Tf 0.4 0.4 0.4 rg 50 {$evY} Td (Tidak ada sampel bukti spesifik yang terlampir.) Tj ET";
        } else {
            foreach ($evList as $ev) {
                $evAccount = $ev->account?->handle ?? '-';
                $evSnippet = $ev->post?->text ? substr($ev->post->text, 0, 60).'...' : 'Data anomali metadata';
                $lines[] = "BT /F2 8 Tf 0 0 0 rg 50 {$evY} Td ([{$ev->reason}]) Tj /F1 8 Tf 100 0 Td ({$this->escape($evAccount)}: ".$this->escape($evSnippet).') Tj ET';
                $evY -= 18;
            }
        }

        // Legal & Archival Footer
        $lines[] = 'q 0.6 0.6 0.6 RG 40 100 515 0.5 re S Q';
        $lines[] = 'BT /F1 8 Tf 0.4 0.4 0.4 rg 40 85 Td (Dokumen ini dihasilkan secara otomatis oleh RadarIsu - Sistem Peringatan Dini Isu & Siber Sosial.) Tj ET';
        $lines[] = 'BT /F1 8 Tf 0.4 0.4 0.4 rg 40 73 Td (Rantai keputusan dicatat pada tabel audit_logs yang bersifat append-only anti-tamper.) Tj ET';

        $contentStream = implode("\n", $lines);

        return $this->buildPdf($contentStream);
    }

    private function wrapText(string $text, int $maxChars): array
    {
        $words = explode(' ', $text);
        $lines = [];
        $current = '';
        foreach ($words as $word) {
            if (strlen($current.' '.$word) > $maxChars) {
                if ($current !== '') {
                    $lines[] = trim($current);
                }
                $current = $word;
            } else {
                $current .= ' '.$word;
            }
        }
        if (trim($current) !== '') {
            $lines[] = trim($current);
        }

        return $lines;
    }

    private function escape(string $text): string
    {
        $clean = preg_replace('/[^\x20-\x7E]/', ' ', $text);

        return str_replace(['\\', '(', ')'], ['\\\\', '\\(', '\\)'], (string) $clean);
    }

    private function buildPdf(string $stream): string
    {
        $streamLen = strlen($stream);

        $objects = [];
        $objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';
        $objects[2] = '<< /Type /Pages /Kids [3 0 R] /Count 1 >>';
        $objects[3] = '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>';
        $objects[4] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>';
        $objects[5] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>';
        $objects[6] = "<< /Length {$streamLen} >>\nstream\n{$stream}\nendstream";

        $output = "%PDF-1.4\n";
        $offsets = [];
        for ($i = 1; $i <= 6; $i++) {
            $offsets[$i] = strlen($output);
            $output .= "{$i} 0 obj\n".$objects[$i]."\nendobj\n";
        }

        $xrefStart = strlen($output);
        $output .= "xref\n0 7\n";
        $output .= "0000000000 65535 f \n";
        for ($i = 1; $i <= 6; $i++) {
            $output .= sprintf("%010d 00000 n \n", $offsets[$i]);
        }
        $output .= "trailer\n<< /Size 7 /Root 1 0 R >>\n";
        $output .= "startxref\n{$xrefStart}\n%%EOF\n";

        return $output;
    }
}
