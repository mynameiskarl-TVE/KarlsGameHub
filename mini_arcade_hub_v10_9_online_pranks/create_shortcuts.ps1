# Creates shortcuts with the Karl Games icon for the two .bat files.
# (Windows does not allow a custom icon on a .bat file itself, but a shortcut to it can have one.)
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$icon = Join-Path $here 'icon.ico'
$shell = New-Object -ComObject WScript.Shell
$items = @(
    @{ Name = 'Play Mini Arcade Hub';  Target = 'run_game.bat' },
    @{ Name = 'Build Mini Arcade Hub'; Target = 'build_release.bat' }
)
foreach ($item in $items) {
    $link = $shell.CreateShortcut((Join-Path $here ($item.Name + '.lnk')))
    $link.TargetPath = Join-Path $here $item.Target
    $link.WorkingDirectory = $here
    $link.IconLocation = "$icon,0"
    $link.Save()
}
Write-Host "Shortcuts created in: $here"
