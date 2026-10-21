<?php

namespace App\Support;

use Closure;
use RuntimeException;

/**
 * SSRF protection for admin-configured URLs (PRD v2.2 §13).
 *
 * A URL is allowed only if it is http(s) and every address its host resolves to is public.
 * The caller must pin the request to the returned IP (CURLOPT_RESOLVE) so a second DNS
 * lookup cannot point the connection somewhere else (DNS rebinding).
 */
class OutboundUrlGuard
{
    /** @var Closure(string): list<string> */
    private Closure $resolver;

    /**
     * @param  (Closure(string): list<string>)|null  $resolver  Host → IP addresses; replaceable in tests.
     */
    public function __construct(?Closure $resolver = null)
    {
        $this->resolver = $resolver ?? self::systemResolver(...);
    }

    /**
     * @return array{host: string, port: int, ip: string}
     *
     * @throws RuntimeException with a diagnostic message when the URL is not allowed.
     */
    public function check(string $url): array
    {
        $parts = parse_url($url);
        $scheme = strtolower($parts['scheme'] ?? '');
        $host = $parts['host'] ?? '';

        if (! in_array($scheme, ['http', 'https'], true) || $host === '') {
            throw new RuntimeException('Only http(s) URLs with a host are allowed.');
        }

        $port = $parts['port'] ?? ($scheme === 'https' ? 443 : 80);
        $literal = trim($host, '[]');
        $ips = filter_var($literal, FILTER_VALIDATE_IP) ? [$literal] : ($this->resolver)($host);

        if ($ips === []) {
            throw new RuntimeException("Host [$host] could not be resolved.");
        }

        foreach ($ips as $ip) {
            if (! self::isPublic($ip)) {
                throw new RuntimeException("Host [$host] resolves to a non-public address.");
            }
        }

        return ['host' => $host, 'port' => (int) $port, 'ip' => $ips[0]];
    }

    /**
     * Value for CURLOPT_RESOLVE that pins $host:$port to the checked IP.
     *
     * @param  array{host: string, port: int, ip: string}  $target
     */
    public static function curlResolve(array $target): string
    {
        $ip = str_contains($target['ip'], ':') ? "[{$target['ip']}]" : $target['ip'];

        return "{$target['host']}:{$target['port']}:{$ip}";
    }

    public static function isPublic(string $ip): bool
    {
        if (! filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE)) {
            return false; // private, loopback, link-local (incl. cloud metadata), reserved
        }

        // Carrier-grade NAT (100.64.0.0/10) is not covered by the PHP flags.
        $long = ip2long($ip);

        return $long === false || ($long & 0xFFC00000) !== (ip2long('100.64.0.0') & 0xFFC00000);
    }

    /**
     * @return list<string>
     */
    private static function systemResolver(string $host): array
    {
        $ips = gethostbynamel($host) ?: [];
        foreach (@dns_get_record($host, DNS_AAAA) ?: [] as $record) {
            $ips[] = $record['ipv6'];
        }

        return array_values(array_unique($ips));
    }
}
