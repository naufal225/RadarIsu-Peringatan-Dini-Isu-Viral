<?php

/*
|--------------------------------------------------------------------------
| RBAC source of truth (PRD §8.1–§8.3)
|--------------------------------------------------------------------------
|
| RoleSeeder and PermissionSeeder read this file. Display names are the
| Indonesian UI labels from PRD §14; the frontend keeps its own label map.
|
*/

return [

    'roles' => [
        'admin' => 'Admin Sistem',
        'analyst' => 'Analis',
        'leader' => 'Pimpinan',
    ],

    // slug => [name, group]
    'permissions' => [
        'system.status' => ['System status', 'system'],
        'users.view' => ['View users', 'users'],
        'users.manage' => ['Manage users', 'users'],
        'sources.view' => ['View sources', 'sources'],
        'sources.manage' => ['Manage sources', 'sources'],
        'replay.manage' => ['Manage replay', 'replay'],
        'audit.view' => ['View audit log', 'audit'],
        'settings.manage' => ['Manage detection settings', 'settings'],
        'topics.view' => ['View topics', 'topics'],
        'topics.manage' => ['Manage topics', 'topics'],
        'dashboard.view' => ['View dashboard', 'dashboard'],
        'alerts.view' => ['View alerts', 'alerts'],
        'alerts.triage' => ['Triage alerts', 'alerts'],
        'alerts.decide' => ['Decide alerts', 'alerts'],
        'briefings.view' => ['View briefings', 'briefings'],
        'briefings.create' => ['Create briefings', 'briefings'],
        'briefings.download' => ['Download briefings', 'briefings'],
        'labels.manage' => ['Manage labels', 'evaluation'],
        'evaluation.view' => ['View evaluation', 'evaluation'],
        'evaluation.run' => ['Run evaluation', 'evaluation'],
    ],

    'matrix' => [
        'admin' => [
            'system.status', 'users.view', 'users.manage', 'sources.view', 'sources.manage',
            'replay.manage', 'audit.view', 'settings.manage', 'evaluation.view', 'evaluation.run',
        ],
        'analyst' => [
            'topics.view', 'topics.manage', 'dashboard.view', 'alerts.view', 'alerts.triage',
            'briefings.view', 'briefings.create', 'briefings.download', 'labels.manage',
            'evaluation.view', 'evaluation.run',
        ],
        'leader' => [
            'topics.view', 'dashboard.view', 'alerts.view', 'alerts.decide',
            'briefings.view', 'briefings.download', 'evaluation.view',
        ],
    ],

];
