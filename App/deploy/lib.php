<?php
// Shared helpers for the deploy/ PHP endpoints (index.php,
// member-sponsor-form.php, public-sponsor-form.php, sponsor-submissions.php,
// registrations-upload.php). Centralizes the auth
// check, lock-guarded JSON read/write, and safe-inline-script-embedding
// logic that would otherwise be copy-pasted across four files.

// True if either the current PHP session is already authenticated (the
// normal case for same-origin calls made from the hosted page itself, e.g.
// sponsor edits from the Sponsors tab while logged in) or the request
// supplied a password matching secrets.php's hash (the normal case for
// calls with no shared session, e.g. the offline tool's cross-origin
// "Import from Server").
function carshow_authed($passwordHash, $providedPassword) {
    if (!empty($_SESSION['carshow_authenticated'])) return true;
    $pw = (string)$providedPassword;
    return $pw !== '' && hash_equals($passwordHash, crypt($pw, $passwordHash));
}

function carshow_read_json_list($file) {
    if (!is_file($file)) return [];
    $raw = file_get_contents($file);
    $decoded = $raw ? json_decode($raw, true) : [];
    return is_array($decoded) ? $decoded : [];
}

// Lock-guarded overwrite so a public form submission and an officer's edit
// landing at nearly the same moment can't clobber each other.
function carshow_write_json($file, $value) {
    $fh = fopen($file, 'c+');
    if (!$fh || !flock($fh, LOCK_EX)) {
        if ($fh) fclose($fh);
        return false;
    }
    ftruncate($fh, 0);
    rewind($fh);
    fwrite($fh, json_encode($value, JSON_PRETTY_PRINT));
    fflush($fh);
    flock($fh, LOCK_UN);
    fclose($fh);
    return true;
}

// Appends one record to a JSON-array file under the same lock (read +
// modify + write as one atomic step, so a concurrent append can't be lost).
function carshow_append_json_list($file, $record) {
    $fh = fopen($file, 'c+');
    if (!$fh || !flock($fh, LOCK_EX)) {
        if ($fh) fclose($fh);
        return false;
    }
    $size = filesize($file) ?: 0;
    $raw = $size > 0 ? fread($fh, $size) : '';
    $list = $raw ? json_decode($raw, true) : [];
    if (!is_array($list)) $list = [];
    $list[] = $record;
    ftruncate($fh, 0);
    rewind($fh);
    fwrite($fh, json_encode($list, JSON_PRETTY_PRINT));
    fflush($fh);
    flock($fh, LOCK_UN);
    fclose($fh);
    return true;
}

// Encodes a PHP value as JSON safe to embed inside an inline <script> block:
// guards the two line-terminator code points JSON leaves unescaped but that
// choke some JS engines inside string literals, and neutralizes "</script"
// so real data containing that literal substring (e.g. a pasted comment)
// can't prematurely close the tag.
function carshow_safe_inline_json($value) {
    $json = json_encode($value);
    $json = str_replace(["\xE2\x80\xA8", "\xE2\x80\xA9"], ['\\u2028', '\\u2029'], $json);
    $json = str_ireplace('</script', '<\\/script', $json);
    return $json;
}

// Minimal SMTP client (AUTH LOGIN, implicit TLS on 465 or STARTTLS on 587) —
// used instead of PHP's raw mail(), which was observed returning success
// while silently failing to actually deliver to Gmail from this Hostinger
// account (no SPF/DKIM behind mail()'s local sendmail path; mail()'s return
// value only confirms local hand-off, not delivery). No external
// library/Composer — self-contained, matching every other deploy/ endpoint.
// Credentials come from secrets.php's $SMTP_* vars; returns false (caller
// should show an error) if they're not configured or sending fails at any
// step of the conversation.
// Splits a comma/semicolon-separated string into validated email addresses,
// silently dropping anything that fails FILTER_VALIDATE_EMAIL. Used for
// settings-driven To/CC/BCC fields that may hold multiple addresses (e.g.
// the New Sponsor Confirmation Email settings card).
function carshow_parse_addr_list($raw) {
    if (!is_string($raw) || trim($raw) === '') return [];
    $out = [];
    foreach (preg_split('/[,;]+/', $raw) as $part) {
        $part = trim($part);
        if ($part !== '' && filter_var($part, FILTER_VALIDATE_EMAIL)) $out[] = $part;
    }
    return $out;
}

function carshow_send_mail($to, $subject, $body, $cc = '', $bcc = '', $html = false) {
    // Plain require (not require_once): require_once tracks inclusion by
    // resolved file path regardless of scope, so if some other code in this
    // request already required secrets.php, require_once here would
    // silently no-op and leave these locals undefined. secrets.php is just
    // variable assignments, so re-running it is harmless.
    $secretsFile = __DIR__ . '/secrets.php';
    if (is_file($secretsFile)) require $secretsFile;
    if (empty($SMTP_HOST) || empty($SMTP_USER) || empty($SMTP_PASS)) return false;

    $port = !empty($SMTP_PORT) ? (int)$SMTP_PORT : 465;
    $from = !empty($SMTP_FROM) ? $SMTP_FROM : $SMTP_USER;
    $target = ($port === 465 ? 'ssl://' : '') . $SMTP_HOST . ':' . $port;

    $sock = @stream_socket_client($target, $errno, $errstr, 15);
    if (!$sock) return false;
    stream_set_timeout($sock, 15);

    // Reads a full (possibly multi-line) reply: SMTP marks the final line of
    // a multi-line response with a space in the 4th column (e.g. "250 OK"
    // vs "250-continues"); anything else means keep reading.
    $read = function () use ($sock) {
        $data = '';
        while (($line = fgets($sock, 515)) !== false) {
            $data .= $line;
            if (strlen($line) < 4 || $line[3] === ' ') break;
        }
        return $data;
    };
    $write = function ($cmd) use ($sock) { fwrite($sock, $cmd . "\r\n"); };
    $expect = function ($code) use ($read) { return strpos($read(), (string)$code) === 0; };
    $fail = function () use ($sock) { fclose($sock); return false; };

    $read(); // server greeting
    $write('EHLO etccapps.com');
    $read();

    if ($port !== 465) {
        $write('STARTTLS');
        if (!$expect(220)) return $fail();
        if (!stream_socket_enable_crypto($sock, true, STREAM_CRYPTO_METHOD_TLS_CLIENT)) return $fail();
        $write('EHLO etccapps.com');
        $read();
    }

    $write('AUTH LOGIN');
    if (!$expect(334)) return $fail();
    $write(base64_encode($SMTP_USER));
    if (!$expect(334)) return $fail();
    $write(base64_encode($SMTP_PASS));
    if (!$expect(235)) return $fail();

    $write('MAIL FROM:<' . $from . '>');
    if (!$expect(250)) return $fail();
    // $to may be a single address (every pre-existing caller) or a
    // comma/semicolon-separated list (settings-driven callers).
    $toList = carshow_parse_addr_list($to);
    if (!$toList && filter_var(trim((string)$to), FILTER_VALIDATE_EMAIL)) $toList = [trim($to)];
    if (!$toList) return $fail();
    foreach ($toList as $toEmail) {
        $write('RCPT TO:<' . $toEmail . '>');
        if (!$expect(250)) return $fail();
    }

    // Add CC recipients
    if (!empty($cc)) {
        $ccList = array_map('trim', explode(',', $cc));
        foreach ($ccList as $ccEmail) {
            if (!empty($ccEmail)) {
                $write('RCPT TO:<' . $ccEmail . '>');
                if (!$expect(250)) return $fail();
            }
        }
    }

    // Add BCC recipients
    if (!empty($bcc)) {
        $bccList = array_map('trim', explode(',', $bcc));
        foreach ($bccList as $bccEmail) {
            if (!empty($bccEmail)) {
                $write('RCPT TO:<' . $bccEmail . '>');
                if (!$expect(250)) return $fail();
            }
        }
    }

    $write('DATA');
    if (!$expect(354)) return $fail();

    $headers = "From: {$from}\r\nTo: " . implode(', ', $toList) . "\r\n";
    if (!empty($cc)) $headers .= "Cc: {$cc}\r\n";
    $contentType = $html ? 'text/html' : 'text/plain';
    $headers .= "Subject: {$subject}\r\n" .
        "MIME-Version: 1.0\r\nContent-Type: {$contentType}; charset=UTF-8\r\n";
    // Dot-stuffing: a line starting with "." in the body must be escaped to
    // ".." or the SMTP server reads it as the end-of-DATA terminator.
    $safeBody = preg_replace('/^\./m', '..', $body);
    $write($headers . "\r\n" . $safeBody . "\r\n.");
    $ok = $expect(250);
    $write('QUIT');
    fclose($sock);
    return $ok;
}
