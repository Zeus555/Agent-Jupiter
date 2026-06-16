param (
    [string]$visible,
    [int]$targetPid = 0
)

# nCmdShow: 0 = Hide, 5 = Show, 6 = Minimize, 9 = Restore
$showCmd = if ($visible -eq "true" -or $visible -eq "$true" -or $visible -eq "1") { 5 } else { 0 }

# --- WIN32 API DEFINITIONS ---
if (-not ([System.Management.Automation.PSTypeName]'Win32.Native').Type) {
    try {
        $signature = @"
        [DllImport("user32.dll")]
        public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);

        [DllImport("user32.dll")]
        public static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);

        public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

        [DllImport("user32.dll")]
        public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);

        [DllImport("user32.dll", CharSet = CharSet.Auto, SetLastError = true)]
        public static extern int GetWindowText(IntPtr hWnd, System.Text.StringBuilder lpString, int nMaxCount);
"@
        Add-Type -MemberDefinition $signature -Name Native -Namespace Win32
    } catch { }
}

# --- HELPER: Find all Window Handles for a given PID ---
function Get-WindowHandlesById([uint32]$procIdToFind) {
    $foundHandles = New-Object System.Collections.Generic.List[IntPtr]
    $callback = [Win32.Native+EnumWindowsProc] {
        param($hwnd, $lparam)
        $windowPid = 0
        [Win32.Native]::GetWindowThreadProcessId($hwnd, [ref]$windowPid)
        if ($windowPid -eq $procIdToFind) {
            $foundHandles.Add($hwnd)
        }
        return $true
    }
    [Win32.Native]::EnumWindows($callback, [IntPtr]::Zero) | Out-Null
    return $foundHandles
}

function Invoke-ShowWindow([IntPtr]$handle, [int]$command) {
    if ($handle -ne [IntPtr]::Zero) {
        if ($command -eq 0) {
            [Win32.Native]::ShowWindow($handle, 6) # Minimize
            Start-Sleep -Milliseconds 100
        }
        [Win32.Native]::ShowWindow($handle, $command)
        return $true
    }
    return $false
}

# --- LOGIC ---

# 1. Identify Target PIDs
$pidsList = New-Object System.Collections.Generic.List[uint32]
if ($targetPid -gt 0) {
    $pidsList.Add($targetPid)
}

# Always also look for the project specific Chrome processes
$projectProcesses = Get-CimInstance Win32_Process -Filter "Name = 'chrome.exe'" | Where-Object { $_.CommandLine -like "*PRC Agent Jupiter*" }
foreach ($proc in $projectProcesses) {
    if (-not $pidsList.Contains($proc.ProcessId)) { $pidsList.Add($proc.ProcessId) }
}

if ($pidsList.Count -eq 0) {
    # Last resort fallback by Title
    $general = Get-Process chrome -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowTitle -like "*Jupiter*" }
    foreach ($p in $general) {
        if (-not $pidsList.Contains($p.Id)) { $pidsList.Add($p.Id) }
    }
}

# 2. Iterate PIDs and toggle ALL their windows
$finalFoundCount = 0
foreach ($currentProcId in $pidsList) {
    $handles = Get-WindowHandlesById $currentProcId
    foreach ($handle in $handles) {
        if ($handle -eq [IntPtr]::Zero -or $handle -is [bool]) { continue }
        
        # We care about all windows for the main process
        if (Invoke-ShowWindow $handle $showCmd) {
            Write-Host "Success: Toggled visibility for PID $currentProcId (Handle: $handle) to $visible"
            $finalFoundCount++
        }
    }
}

if ($finalFoundCount -eq 0) {
    Write-Host "No Jupiter Chrome windows found matching PIDs: $($pidsList -join ', ')"
    exit 1
}

exit 0
