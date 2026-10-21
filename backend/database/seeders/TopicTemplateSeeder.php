<?php

namespace Database\Seeders;

use App\Models\Topic;
use Illuminate\Database\Seeder;

class TopicTemplateSeeder extends Seeder
{
    /**
     * UC1–UC3 templates (PRD §9.8). Keywords are placeholders the analyst must replace.
     */
    public function run(): void
    {
        $templates = [
            ['Isu terhadap [nama institusi/satuan]', 'institution', ['[nama institusi]', '[nama satuan]']],
            ['Peniruan akun resmi [nama satuan]', 'impersonation', ['[nama satuan]', '[nama akun resmi]']],
            ['Istilah sensitif [ditetapkan satuan]', 'opsec', ['[istilah sensitif]']],
        ];

        foreach ($templates as [$name, $category, $keywords]) {
            Topic::updateOrCreate(
                ['name' => $name, 'is_template' => true],
                ['category' => $category, 'keywords' => $keywords, 'sensitivity' => 'medium', 'is_active' => false],
            );
        }
    }
}
