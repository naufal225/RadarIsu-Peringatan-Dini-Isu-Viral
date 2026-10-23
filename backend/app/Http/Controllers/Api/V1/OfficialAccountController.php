<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\OfficialAccountResource;
use App\Models\OfficialAccount;
use App\Services\Audit\AuditLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;

/**
 * Official accounts the impersonation detector compares new accounts with (PRD §9.3, §11, F2).
 */
class OfficialAccountController extends Controller
{
    public function __construct(private AuditLogger $audit) {}

    public function index(): AnonymousResourceCollection
    {
        return OfficialAccountResource::collection(OfficialAccount::orderBy('handle')->get());
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'handle' => 'required|string|max:190|unique:official_accounts,handle',
            'display_name' => 'required|string|max:190',
            'note' => 'nullable|string|max:255',
        ]);

        $account = OfficialAccount::create([...$data, 'created_by' => $request->user()->id]);

        $this->audit->log('official_account.create', $account, ['handle' => $account->handle, 'display_name' => $account->display_name]);

        return (new OfficialAccountResource($account))->response()->setStatusCode(201);
    }

    public function destroy(OfficialAccount $officialAccount): Response
    {
        $officialAccount->delete();

        $this->audit->log('official_account.delete', $officialAccount, ['handle' => $officialAccount->handle]);

        return response()->noContent();
    }
}
