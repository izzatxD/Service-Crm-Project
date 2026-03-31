$ErrorActionPreference = 'Stop'

$baseUrl = 'http://localhost:3000/api'
$stamp = Get-Date -Format 'yyyyMMddHHmmss'

function Test-Truthy {
  param([string]$Value)

  if ($null -eq $Value) {
    return $false
  }

  return @('1', 'true', 'yes', 'y', 'on') -contains ($Value.Trim().ToLower())
}

if ($env:E2E_SUPER_ADMIN_EMAIL -and $env:E2E_SUPER_ADMIN_PASSWORD) {
  $superAdminEmail = $env:E2E_SUPER_ADMIN_EMAIL
  $superAdminPassword = $env:E2E_SUPER_ADMIN_PASSWORD
}
elseif ((Test-Truthy $env:SEED_PLATFORM_ENABLED) -and $env:SEED_PLATFORM_EMAIL -and $env:SEED_PLATFORM_PASSWORD) {
  $superAdminEmail = $env:SEED_PLATFORM_EMAIL
  $superAdminPassword = $env:SEED_PLATFORM_PASSWORD
}
else {
  throw 'Super admin credentials topilmadi. E2E_SUPER_ADMIN_EMAIL va E2E_SUPER_ADMIN_PASSWORD ni bering yoki platform seedni SEED_PLATFORM_ENABLED=true bilan yoqing.'
}

function Invoke-Api {
  param(
    [Parameter(Mandatory = $true)][string]$Method,
    [Parameter(Mandatory = $true)][string]$Path,
    [object]$Body,
    [string]$Token
  )

  $headers = @{}
  if ($Token) {
    $headers['Authorization'] = "Bearer $Token"
  }

  if ($PSBoundParameters.ContainsKey('Body')) {
    $json = $Body | ConvertTo-Json -Depth 10
    return Invoke-RestMethod -Method $Method -Uri "$baseUrl$Path" -Headers $headers -ContentType 'application/json' -Body $json
  }

  return Invoke-RestMethod -Method $Method -Uri "$baseUrl$Path" -Headers $headers
}

function Write-Step {
  param([string]$Message)
  Write-Host "`n==> $Message" -ForegroundColor Cyan
}

Write-Step 'Super admin login'
$login = Invoke-Api -Method Post -Path '/auth/login' -Body @{
  email = $superAdminEmail
  password = $superAdminPassword
}
$token = $login.accessToken

Write-Step 'Demo organization va branch yaratish'
$organization = Invoke-Api -Method Post -Path '/organizations' -Token $token -Body @{
  name = "Demo Service $stamp"
  businessTypeCode = 'auto_service'
  timezone = 'Asia/Tashkent'
  currencyCode = 'UZS'
}

$branch = Invoke-Api -Method Post -Path '/branches' -Token $token -Body @{
  organizationId = $organization.id
  name = 'Main branch'
  code = "MN-$stamp"
  phone = '+998900000001'
  addressLine = 'Toshkent, test branch'
}

Write-Step 'Demo staff accountlar yaratish'
$owner = Invoke-Api -Method Post -Path '/staff' -Token $token -Body @{
  organizationId = $organization.id
  fullName = 'Demo Owner'
  email = "owner.$stamp@test.local"
  password = 'DemoOwner123!'
  primaryRole = 'admin'
}

$manager = Invoke-Api -Method Post -Path '/staff' -Token $token -Body @{
  organizationId = $organization.id
  fullName = 'Demo Manager'
  email = "manager.$stamp@test.local"
  password = 'DemoManager123!'
  primaryRole = 'manager'
}

$worker1 = Invoke-Api -Method Post -Path '/staff' -Token $token -Body @{
  organizationId = $organization.id
  fullName = 'Usta Aziz'
  email = "worker1.$stamp@test.local"
  password = 'DemoWorker123!'
  primaryRole = 'worker'
}

$worker2 = Invoke-Api -Method Post -Path '/staff' -Token $token -Body @{
  organizationId = $organization.id
  fullName = 'Usta Bek'
  email = "worker2.$stamp@test.local"
  password = 'DemoWorker123!'
  primaryRole = 'worker'
}

$cashier = Invoke-Api -Method Post -Path '/staff' -Token $token -Body @{
  organizationId = $organization.id
  fullName = 'Demo Cashier'
  email = "cashier.$stamp@test.local"
  password = 'DemoCashier123!'
  primaryRole = 'cashier'
}

Write-Step 'Yangi organization admin accountini login test qilish'
$ownerLogin = Invoke-Api -Method Post -Path '/auth/login' -Body @{
  email = "owner.$stamp@test.local"
  password = 'DemoOwner123!'
}

Write-Step 'Order workflow yaratish'
$order = Invoke-Api -Method Post -Path '/orders/workflow' -Token $token -Body @{
  organizationId = $organization.id
  branchId = $branch.id
  createdByStaffId = $manager.id
  assignedManagerId = $manager.id
  customerRequestText = 'Motor tomondan shovqin va moy sizishi bor.'
  intakeNotes = 'Klient mashinani o''zi olib keldi.'
  client = @{
    fullName = 'Test Client'
    phone = '+998901111111'
    note = 'Telefon orqali bog''lanish kerak'
  }
  asset = @{
    assetTypeCode = 'vehicle'
    displayName = 'Chevrolet Cobalt'
    note = 'Oq rang'
  }
  vehicleProfile = @{
    make = 'Chevrolet'
    model = 'Cobalt'
    year = 2023
    plateNumber = '01A777AA'
  }
  tasks = @(
    @{
      lineNo = 1
      title = 'Diagnostika'
      assignedStaffId = $worker1.id
      estimatedLaborAmount = 80000
      note = 'Boshlang''ich tekshiruv'
    },
    @{
      lineNo = 2
      title = 'Moy almashtirish'
      assignedStaffId = $worker1.id
      estimatedLaborAmount = 120000
    },
    @{
      lineNo = 3
      title = 'Old kolodka tekshirish'
      assignedStaffId = $worker2.id
      estimatedLaborAmount = 90000
    },
    @{
      lineNo = 4
      title = 'Kompyuter diagnostika'
      assignedStaffId = $worker2.id
      estimatedLaborAmount = 70000
    },
    @{
      lineNo = 5
      title = 'Yakuniy test drive'
      assignedStaffId = $manager.id
      estimatedLaborAmount = 50000
    }
  )
}

$orderId = $order.id
$orderDetail = Invoke-Api -Method Get -Path "/orders/$orderId" -Token $token
$tasks = @($orderDetail.tasks)

Write-Step 'Tasklarni ustalarga assignment qilish'
foreach ($task in $tasks) {
  $targetStaffId = if ($task.assignedStaffId) { $task.assignedStaffId } else { $worker1.id }
  [void](Invoke-Api -Method Post -Path '/order-assignments' -Token $token -Body @{
    organizationId = $organization.id
    orderId = $orderId
    orderTaskId = $task.id
    toStaffId = $targetStaffId
    assignedByStaffId = $manager.id
    assignmentTypeCode = 'task_execution'
    note = 'Demo assignment'
  })
}

Write-Step 'Approval oqimini test qilish'
$approval = Invoke-Api -Method Post -Path '/order-approvals' -Token $token -Body @{
  organizationId = $organization.id
  orderId = $orderId
  requestedByStaffId = $manager.id
  approvalTypeCode = 'estimate'
  requestNote = 'Narxni tasdiqlash'
}

[void](Invoke-Api -Method Patch -Path "/order-approvals/$($approval.id)" -Token $token -Body @{
  approvedByStaffId = $owner.id
  status = 'approved'
  decisionNote = 'Tasdiqlandi'
})

Write-Step 'Status transitionlarni test qilish'
[void](Invoke-Api -Method Post -Path '/order-status-history' -Token $token -Body @{
  organizationId = $organization.id
  orderId = $orderId
  toStatus = 'pending_diagnosis'
  changedByStaffId = $manager.id
  note = 'Diagnostika boshlandi'
})
[void](Invoke-Api -Method Post -Path '/order-status-history' -Token $token -Body @{
  organizationId = $organization.id
  orderId = $orderId
  toStatus = 'estimated'
  changedByStaffId = $manager.id
  note = 'Smeta tayyorlandi'
})
[void](Invoke-Api -Method Post -Path '/order-status-history' -Token $token -Body @{
  organizationId = $organization.id
  orderId = $orderId
  toStatus = 'approved'
  changedByStaffId = $owner.id
  note = 'Klient roziligi olindi'
})
[void](Invoke-Api -Method Post -Path '/order-status-history' -Token $token -Body @{
  organizationId = $organization.id
  orderId = $orderId
  toStatus = 'in_progress'
  changedByStaffId = $manager.id
  note = 'Ish boshlandi'
})

Write-Step 'Inventory item va stock movement yaratish'
$item1 = Invoke-Api -Method Post -Path '/inventory-items' -Token $token -Body @{
  organizationId = $organization.id
  itemTypeCode = 'part'
  name = 'Motor moyi 4L'
  sku = "OIL-$stamp"
  unitName = 'dona'
  costPrice = 90000
  salePrice = 125000
}

$item2 = Invoke-Api -Method Post -Path '/inventory-items' -Token $token -Body @{
  organizationId = $organization.id
  itemTypeCode = 'part'
  name = 'Tormoz kolodka'
  sku = "BRK-$stamp"
  unitName = 'kompl'
  costPrice = 150000
  salePrice = 210000
}

[void](Invoke-Api -Method Post -Path '/stock-movements' -Token $token -Body @{
  organizationId = $organization.id
  branchId = $branch.id
  inventoryItemId = $item1.id
  movementType = 'purchase'
  quantity = 8
  unitCostAmount = 90000
  createdByStaffId = $manager.id
  note = 'Demo kirim'
})

[void](Invoke-Api -Method Post -Path '/stock-movements' -Token $token -Body @{
  organizationId = $organization.id
  branchId = $branch.id
  inventoryItemId = $item2.id
  movementType = 'purchase'
  quantity = 4
  unitCostAmount = 150000
  createdByStaffId = $manager.id
  note = 'Demo kirim'
})

Write-Step 'Order task parts orqali sklad va financial recalc test qilish'
[void](Invoke-Api -Method Post -Path '/order-task-parts' -Token $token -Body @{
  organizationId = $organization.id
  orderTaskId = $tasks[1].id
  inventoryItemId = $item1.id
  quantity = 1
  unitCostAmount = 90000
  unitPriceAmount = 125000
})

[void](Invoke-Api -Method Post -Path '/order-task-parts' -Token $token -Body @{
  organizationId = $organization.id
  orderTaskId = $tasks[2].id
  inventoryItemId = $item2.id
  quantity = 1
  unitCostAmount = 150000
  unitPriceAmount = 210000
})

Write-Step 'Task statuslarini completed qilish'
foreach ($task in $tasks) {
  [void](Invoke-Api -Method Patch -Path "/order-tasks/$($task.id)" -Token $token -Body @{
    status = 'completed'
    actualLaborAmount = $task.estimatedLaborAmount
  })
}

Write-Step 'Payment va expense oqimini test qilish'
$paymentMethods = Invoke-Api -Method Get -Path "/payment-methods?organizationId=$($organization.id)" -Token $token
[string]$paymentMethodCode = if (@($paymentMethods).Count -gt 0) {
  @($paymentMethods)[0].paymentMethodCode
} else {
  'cash'
}
[void](Invoke-Api -Method Post -Path '/payments' -Token $token -Body @{
  organizationId = $organization.id
  orderId = $orderId
  paymentMethodCode = $paymentMethodCode
  amount = 300000
  paidAt = (Get-Date).ToString('o')
  receivedByStaffId = $cashier.id
  note = 'Avans'
})

[void](Invoke-Api -Method Post -Path '/payments' -Token $token -Body @{
  organizationId = $organization.id
  orderId = $orderId
  paymentMethodCode = $paymentMethodCode
  amount = 445000
  paidAt = (Get-Date).AddMinutes(10).ToString('o')
  receivedByStaffId = $cashier.id
  note = 'Yakuniy to''lov'
})

$expenseCategory = Invoke-Api -Method Post -Path '/expense-categories' -Token $token -Body @{
  organizationId = $organization.id
  name = 'Operatsion xarajat'
  code = "OPS-$stamp"
}

[void](Invoke-Api -Method Post -Path '/expenses' -Token $token -Body @{
  organizationId = $organization.id
  branchId = $branch.id
  expenseCategoryId = $expenseCategory.id
  title = 'Yetkazib berish va mayda xarid'
  amount = 120000
  relatedOrderId = $orderId
  createdByStaffId = $cashier.id
  expenseDate = (Get-Date).ToString('o')
  note = 'Demo expense'
})

Write-Step 'Orderni yakuniy statuslarga olib chiqish'
[void](Invoke-Api -Method Post -Path '/order-status-history' -Token $token -Body @{
  organizationId = $organization.id
  orderId = $orderId
  toStatus = 'completed'
  changedByStaffId = $manager.id
  note = 'Ishlar yakunlandi'
})
[void](Invoke-Api -Method Post -Path '/order-status-history' -Token $token -Body @{
  organizationId = $organization.id
  orderId = $orderId
  toStatus = 'delivered'
  changedByStaffId = $cashier.id
  note = 'Klient mashinani olib ketdi'
})

Write-Step 'Dashboard summary va final tekshiruv'
$summary = Invoke-Api -Method Get -Path "/dashboard/summary?organizationId=$($organization.id)&branchId=$($branch.id)" -Token $token
$finalOrder = Invoke-Api -Method Get -Path "/orders/$orderId" -Token $token
$stocks = Invoke-Api -Method Get -Path "/inventory-stocks?branchId=$($branch.id)" -Token $token
$payments = Invoke-Api -Method Get -Path "/payments?orderId=$orderId" -Token $token
$expenses = Invoke-Api -Method Get -Path "/expenses?organizationId=$($organization.id)" -Token $token

$result = [pscustomobject]@{
  organization = $organization
  branch = $branch
  accounts = [pscustomobject]@{
    owner = [pscustomobject]@{ email = "owner.$stamp@test.local"; password = 'DemoOwner123!' }
    manager = [pscustomobject]@{ email = "manager.$stamp@test.local"; password = 'DemoManager123!' }
    worker1 = [pscustomobject]@{ email = "worker1.$stamp@test.local"; password = 'DemoWorker123!' }
    worker2 = [pscustomobject]@{ email = "worker2.$stamp@test.local"; password = 'DemoWorker123!' }
    cashier = [pscustomobject]@{ email = "cashier.$stamp@test.local"; password = 'DemoCashier123!' }
  }
  order = [pscustomobject]@{
    id = $finalOrder.id
    orderNumber = $finalOrder.orderNumber
    status = $finalOrder.status
    taskCount = @($finalOrder.tasks).Count
    assignmentCount = @($finalOrder.assignments).Count
    approvalCount = @($finalOrder.approvals).Count
    grandTotal = $finalOrder.financial.grandTotalAmount
    paidTotal = $finalOrder.financial.paidTotalAmount
    balanceDue = $finalOrder.financial.balanceDueAmount
  }
  counts = [pscustomobject]@{
    stocks = @($stocks).Count
    payments = @($payments).Count
    expenses = @($expenses).Count
  }
  dashboard = $summary
} | ConvertTo-Json -Depth 10

Write-Host $result
