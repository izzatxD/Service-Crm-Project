$ErrorActionPreference = 'Stop'

$baseUrl = 'http://localhost:3000/api'

$accounts = @(
  @{
    label = 'admin'
    email = 'demo+admin@crm.local'
    password = 'Demo12345!'
    expectations = @{
      dashboard = 'ok'
      orders = 'ok'
      inventory = 'ok'
      payments = 'ok'
    }
  },
  @{
    label = 'manager'
    email = 'demo+manager@crm.local'
    password = 'Demo12345!'
    expectations = @{
      dashboard = 'ok'
      orders = 'ok'
    }
  },
  @{
    label = 'worker'
    email = 'demo+worker@crm.local'
    password = 'Demo12345!'
    expectations = @{
      dashboard = 'error:403'
      orders = 'ok'
    }
  },
  @{
    label = 'cashier'
    email = 'demo+cashier@crm.local'
    password = 'Demo12345!'
    expectations = @{
      dashboard = 'ok'
      payments = 'ok'
    }
  },
  @{
    label = 'viewer'
    email = 'demo+viewer@crm.local'
    password = 'Demo12345!'
    expectations = @{
      dashboard = 'ok'
      orders = 'ok'
    }
  }
)

function Invoke-JsonRequest {
  param(
    [Parameter(Mandatory = $true)][string]$Method,
    [Parameter(Mandatory = $true)][string]$Uri,
    [hashtable]$Headers,
    [object]$Body
  )

  if ($PSBoundParameters.ContainsKey('Body')) {
    return Invoke-RestMethod `
      -Method $Method `
      -Uri $Uri `
      -Headers $Headers `
      -ContentType 'application/json' `
      -Body ($Body | ConvertTo-Json -Depth 10)
  }

  return Invoke-RestMethod -Method $Method -Uri $Uri -Headers $Headers
}

function Login-Session {
  param(
    [Parameter(Mandatory = $true)][string]$Email,
    [Parameter(Mandatory = $true)][string]$Password
  )

  return Invoke-JsonRequest `
    -Method Post `
    -Uri "$baseUrl/auth/login" `
    -Body @{
      email = $Email
      password = $Password
    }
}

function Test-EndpointAccess {
  param(
    [Parameter(Mandatory = $true)][string]$Uri,
    [Parameter(Mandatory = $true)][hashtable]$Headers
  )

  try {
    Invoke-JsonRequest -Method Get -Uri $Uri -Headers $Headers | Out-Null
    return 'ok'
  } catch {
    $response = $_.Exception.Response
    if ($response -and $response.StatusCode) {
      return "error:$([int]$response.StatusCode)"
    }

    return 'error'
  }
}

$results = @()
$failures = @()

foreach ($account in $accounts) {
  $session = Login-Session -Email $account.email -Password $account.password
  $headers = @{ Authorization = "Bearer $($session.accessToken)" }
  $me = Invoke-JsonRequest -Method Get -Uri "$baseUrl/auth/me" -Headers $headers
  $organizationId = $me.organization.id
  if (-not $organizationId -and $me.organizationIds.Count -gt 0) {
    $organizationId = $me.organizationIds[0]
  }

  if (-not $organizationId) {
    throw "organizationId topilmadi: $($account.label)"
  }

  $checks = [ordered]@{
    dashboard = Test-EndpointAccess -Uri "$baseUrl/dashboard/summary?organizationId=$organizationId" -Headers $headers
    orders = Test-EndpointAccess -Uri "$baseUrl/orders?organizationId=$organizationId" -Headers $headers
    inventory = Test-EndpointAccess -Uri "$baseUrl/inventory-items?organizationId=$organizationId" -Headers $headers
    payments = Test-EndpointAccess -Uri "$baseUrl/payment-methods?organizationId=$organizationId" -Headers $headers
    expenses = Test-EndpointAccess -Uri "$baseUrl/expenses?organizationId=$organizationId" -Headers $headers
  }

  foreach ($expectation in $account.expectations.GetEnumerator()) {
    $actual = $checks[$expectation.Key]
    if ($actual -ne $expectation.Value) {
      $failures += "$($account.label): $($expectation.Key) expected $($expectation.Value), got $actual"
    }
  }

  $results += [pscustomobject]@{
    role = $account.label
    email = $account.email
    organizationId = $organizationId
    organizationName = $me.organization.name
    dashboard = $checks.dashboard
    orders = $checks.orders
    inventory = $checks.inventory
    payments = $checks.payments
    expenses = $checks.expenses
    permissions = ($me.permissionCodes -join ', ')
  }
}

Write-Host ''
$results | Format-Table role, dashboard, orders, inventory, payments, expenses -AutoSize
Write-Host ''

if ($failures.Count -gt 0) {
  Write-Host 'Smoke test failures:' -ForegroundColor Red
  $failures | ForEach-Object { Write-Host "- $_" -ForegroundColor Red }
  throw 'Demo role smoke test failed.'
}

Write-Host 'Demo role smoke test passed.' -ForegroundColor Green
