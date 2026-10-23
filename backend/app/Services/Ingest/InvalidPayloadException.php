<?php

namespace App\Services\Ingest;

use RuntimeException;

/**
 * A raw_items payload that does not have the canonical shape (docs/CONTRACTS.md, pipeline contract).
 */
class InvalidPayloadException extends RuntimeException {}
