try {
  $s = Invoke-RestMethod -Uri 'https://job-auto-106i.onrender.com/automation/status' -TimeoutSec 40
  Write-Output ("mode=" + $s.mode)
  Write-Output ("nextRunAt=" + $s.nextRunAt)
  Write-Output ("queue=" + ($s.queue | ConvertTo-Json -Compress))
  Write-Output ("lastRun=" + ($s.lastRun | ConvertTo-Json -Compress -Depth 4))
} catch { Write-Output ("ERR: " + $_.Exception.Message) }
Write-Output "--- domains ---"
try {
  $d = Invoke-RestMethod -Uri 'https://job-auto-106i.onrender.com/automation/auto-apply/domains' -TimeoutSec 40
  Write-Output ($d.allowedDomains -join ", ")
} catch { Write-Output ("ERR: " + $_.Exception.Message) }
Write-Output "--- jobs count ---"
try {
  $j = Invoke-RestMethod -Uri 'https://job-auto-106i.onrender.com/jobs' -TimeoutSec 40
  Write-Output ("total=" + $j.total)
} catch { Write-Output ("ERR: " + $_.Exception.Message) }
