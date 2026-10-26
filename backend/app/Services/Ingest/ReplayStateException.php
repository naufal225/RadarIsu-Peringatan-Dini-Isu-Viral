<?php

namespace App\Services\Ingest;

use RuntimeException;

/** A replay cannot start in the scenario's current state; the message is a machine code the API returns as-is. */
class ReplayStateException extends RuntimeException {}
