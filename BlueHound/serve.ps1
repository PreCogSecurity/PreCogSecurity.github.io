$ErrorActionPreference = 'Stop'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$port = 8080

if (Get-Command python -ErrorAction SilentlyContinue) {
    & python -m http.server $port --directory $here
} elseif (Get-Command py -ErrorAction SilentlyContinue) {
    & py -m http.server $port --directory $here
} elseif (Get-Command npx -ErrorAction SilentlyContinue) {
    & npx --yes serve $here -l $port
} else {
    Write-Host "No local web server found. Install Python or run: npx serve . -l $port"
    exit 1
}