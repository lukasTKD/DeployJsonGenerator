param(
    [Parameter(Mandatory = $true)]
    [string]$CredentialTitle
)

$ErrorActionPreference = 'Stop'
$dataDir = $PSScriptRoot + '\..\..\..\PROD_REPO\'
$dataDir = [System.IO.Path]::GetFullPath($dataDir)
$keePassApiPath = $dataDir + 'API\KeePassVault\KeePassVaultAPI.ps1'

if (-not (Test-Path -LiteralPath $keePassApiPath)) {
    throw "Nie znaleziono KeePassVaultAPI.ps1: $keePassApiPath"
}

.($keePassApiPath)

$cred = KeePass-GetCredentials -title $CredentialTitle
if ($null -eq $cred) {
    throw 'KeePass-GetCredentials zwrocilo null.'
}

$secret = $cred.Secret
if ($secret -is [System.Security.SecureString]) {
    $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secret)
    try {
        $secret = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
    }
    finally {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
    }
}

[pscustomobject]@{
    username = [string]$cred.UserName
    password = [string]$secret
} | ConvertTo-Json -Compress
