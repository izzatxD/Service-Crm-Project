$ErrorActionPreference = 'Stop'

$baseUrl = 'http://localhost:3000/api'

$superAdmin = @{
  email = 'izzatnarimanov@gmail.com'
  password = 'Izzat2050'
}

$accounts = @(
  @{
    label = 'owner'
    email = 'owner.20260326175105@test.local'
    password = 'DemoOwner123!'
  },
  @{
    label = 'manager'
    email = 'manager.20260326175105@test.local'
    password = 'DemoManager123!'
  },
  @{
    label = 'worker'
    email = 'worker1.20260326175105@test.local'
    password = 'DemoWorker123!'
  },
  @{
    label = 'cashier'
    email = 'cashier.20260326175105@test.local'
    password = 'DemoCashier123!'
  }
)

function Login-Session($email, $password) {
  Invoke-RestMethod `
    -Method Post `
    -Uri "$baseUrl/auth/login" `
    -ContentType 'application/json' `
    -Body (@{ email = $email; password = $password } | ConvertTo-Json)
}

function Test-EndpointAccess($uri, $headers) {
  try {
    Invoke-RestMethod -Method Get -Uri $uri -Headers $headers | Out-Null
    return 'ok'
  } catch {
    if ($_.Exception.Response) {
      return "error:$($_.Exception.Response.StatusCode.value__)"
    }

    return 'error'
  }
}

$superSession = Login-Session -email $superAdmin.email -password $superAdmin.password
$superHeaders = @{ Authorization = "Bearer $($superSession.accessToken)" }
$organizations = Invoke-RestMethod -Method Get -Uri "$baseUrl/organizations" -Headers $superHeaders
$demoOrganization = $organizations | Where-Object { $_.name -like 'Demo Service*' } | Select-Object -First 1

if (-not $demoOrganization) {
  throw 'Demo organization topilmadi.'
}

$organizationId = $demoOrganization.id

$endpointMatrix = @(
  @{ key = 'dashboard'; uri = "$baseUrl/dashboard/summary?organizationId=$organizationId" },
  @{ key = 'orders'; uri = "$baseUrl/orders?organizationId=$organizationId" },
  @{ key = 'inventory'; uri = "$baseUrl/inventory-items?organizationId=$organizationId" },
  @{ key = 'payments'; uri = "$baseUrl/payment-methods?organizationId=$organizationId" },
  @{ key = 'expenses'; uri = "$baseUrl/expenses?organizationId=$organizationId" }
)

$results = foreach ($account in $accounts) {
  $session = Login-Session -email $account.email -password $account.password
  $headers = @{ Authorization = "Bearer $($session.accessToken)" }

  $result = [ordered]@{
    role = $account.label
    email = $account.email
    permissions = ($session.permissionCodes -join ', ')
  }

  foreach ($endpoint in $endpointMatrix) {
    $result[$endpoint.key] = Test-EndpointAccess -uri $endpoint.uri -headers $headers
  }

  [pscustomobject]$result
}

Write-Output "Demo organization: $organizationId"
Write-Output ''
$results | Format-Table role, dashboard, orders, inventory, payments, expenses -AutoSize
Write-Output ''
$results | Format-Table role, email, permissions -Wrap
