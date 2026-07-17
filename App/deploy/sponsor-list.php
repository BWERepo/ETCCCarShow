<?php
// Standalone "Sponsor List" page — bookmarkable URL, no login required
// (same pattern as SilentAuctionManager's starting-bid-list.php). Read-only:
// lists every sponsor with Sponsor Name, Sponsor Type, Website, and T-Shirt
// Text, reading sponsor-submissions.json directly (the single always-current
// sponsor list — see sponsor-submissions.php's own header comment).

header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');
require __DIR__ . '/lib.php';

$SPONSOR_TYPES = [
    'premier' => 'Premier ($250)',
    'corporate' => 'Corporate ($100)',
    'individual' => 'Individual ($100)',
];

$sponsors = carshow_read_json_list(__DIR__ . '/sponsor-submissions.json');

usort($sponsors, function ($a, $b) {
    $order = ['premier' => 0, 'corporate' => 1, 'individual' => 2];
    $ta = $order[$a['sponsorType'] ?? ''] ?? 99;
    $tb = $order[$b['sponsorType'] ?? ''] ?? 99;
    if ($ta !== $tb) return $ta <=> $tb;
    return strnatcasecmp((string)($a['name'] ?? ''), (string)($b['name'] ?? ''));
});
?>
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Sponsor List</title>
<style>
  body { font-family: system-ui, sans-serif; margin: 0; color: #1d1d1f; background: #e5e5ea; min-height: 100vh; padding: 32px 16px; box-sizing: border-box; }
  .card { max-width: 700px; margin: 0 auto; background: #fff; border-radius: 12px; box-shadow: 0 4px 24px rgba(0,0,0,0.12); padding: 28px 32px; }
  h2 { margin: 0 0 4px; }
  .sub { font-size: 13px; color: #555; margin-bottom: 16px; }
  .table-wrap { overflow-x: auto; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th { background: #dbeafe; padding: 6px 8px; text-align: left; border: 1px solid #000; font-weight: 600; white-space: nowrap; }
  td { padding: 4px 8px; border: 1px solid #ccc; white-space: nowrap; }
  tr:nth-child(even) td { background: #f0f7ff; }
  @media print {
    button { display: none; }
    body { background: #fff; padding: 0; }
    .card { box-shadow: none; border-radius: 0; padding: 0; max-width: none; }
    .table-wrap { overflow-x: visible; }
    td a { color: inherit; text-decoration: none; }
    @page { size: landscape; margin: 0.4in; }
  }
</style>
</head>
<body>
<div class="card">
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px;">
    <div>
      <h2>Car Show Sponsors</h2>
      <div class="sub">The following businesses and members have sponsored this event.</div>
    </div>
    <div style="display:flex;gap:8px;">
      <button onclick="window.print()" style="padding:6px 16px;background:#0071e3;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:13px;">🖨 Print</button>
      <button onclick="window.close();" style="padding:6px 16px;background:#e0e0e0;color:#1d1d1f;border:none;border-radius:6px;cursor:pointer;font-size:13px;">Done</button>
    </div>
  </div>
  <div class="table-wrap">
  <table>
    <thead><tr><th>Sponsor Name</th><th>Sponsor Type</th><th>Website</th><th>T-Shirt Text</th></tr></thead>
    <tbody>
<?php foreach ($sponsors as $sponsor):
    $type = (string)($sponsor['sponsorType'] ?? '');
    $typeLabel = $SPONSOR_TYPES[$type] ?? $type;
    $name = (string)($sponsor['name'] ?? '');
    $shirtText = (string)($sponsor['individualSponsorshipText'] ?? '');
    if ($shirtText === '') $shirtText = $name;
    $website = trim((string)($sponsor['website'] ?? ''));
    $websiteHref = $website !== '' && !preg_match('~^https?://~i', $website) ? 'https://' . $website : $website;
?>
    <tr>
      <td><?= htmlspecialchars($name) ?></td>
      <td><?= htmlspecialchars($typeLabel) ?></td>
      <td><?php if ($website !== ''): ?><a href="<?= htmlspecialchars($websiteHref) ?>" target="_blank" rel="noopener"><?= htmlspecialchars($website) ?></a><?php endif; ?></td>
      <td><?= htmlspecialchars($shirtText) ?></td>
    </tr>
<?php endforeach; ?>
    </tbody>
  </table>
  </div>
</div>
</body>
</html>
