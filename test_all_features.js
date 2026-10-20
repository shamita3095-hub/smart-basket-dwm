const http = require('node:http');

// Start temporary local server on an open port or use existing server.js app
const app = require('./server/server');
const server = app.listen(0, async () => {
  const port = server.address().port;
  const baseUrl = `http://localhost:${port}`;
  console.log(`\n======================================================`);
  console.log(`RUNNING COMPREHENSIVE END-TO-END TEST SUITE ON PORT ${port}`);
  console.log(`======================================================\n`);

  async function request(path, options = {}) {
    return new Promise((resolve, reject) => {
      const url = new URL(path, baseUrl);
      const req = http.request(url, options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          let json = null;
          try { json = JSON.parse(data); } catch (_) { json = data; }
          resolve({ status: res.statusCode, headers: res.headers, body: json });
        });
      });
      req.on('error', reject);
      if (options.body) {
        req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
      }
      req.end();
    });
  }

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition, testName, details = '') {
    totalTests++;
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      passedTests++;
    } else {
      console.error(`❌ [FAIL] ${testName}: ${details}`);
    }
  }

  try {
    // ---------------------------------------------------------
    // TEST A: Registration & Top Order in Recent Users List
    // ---------------------------------------------------------
    console.log(`\n--- TEST A: Registration & Recent Users Order ---`);
    const regRes = await request('/api/customers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: {
        customerName: 'Aarohi Test Sharma',
        city: 'Pune',
        email: 'aarohi.test@example.com',
        monthlyBudget: 12000
      }
    });

    assert(regRes.status === 201, 'Registration returns 201 Created', `Got status ${regRes.status}`);
    const userA = regRes.body;
    assert(userA.customer_id && userA.customer_id.startsWith('CUST_'), 'User receives unique ID', userA.customer_id);
    assert(userA.created_at, 'User record contains created_at timestamp', userA.created_at);

    // Verify User A appears FIRST in GET /api/customers
    const listRes = await request('/api/customers');
    assert(listRes.status === 200, 'GET /api/customers returns 200 OK');
    const customers = listRes.body;
    assert(customers.length > 0, 'Customers list is not empty');
    assert(customers[0].customer_id === userA.customer_id, 'Newly registered user appears FIRST in recent users list', `First customer was: ${customers[0].customer_id} (${customers[0].customer_name})`);

    // ---------------------------------------------------------
    // TEST B: Budget Selection & Immediate Display
    // ---------------------------------------------------------
    console.log(`\n--- TEST B: Budget Selection & Retrieval ---`);
    const budgetRes1 = await request(`/api/budget/${userA.customer_id}`);
    assert(budgetRes1.status === 200, 'GET /api/budget returns 200 OK');
    assert(budgetRes1.body.monthlyBudget === 12000, 'Initial budget matches registered value (₹12,000)', `Got ${budgetRes1.body.monthlyBudget}`);
    assert(budgetRes1.body.currentSpent === 0, 'Initial spending is ₹0', `Got ${budgetRes1.body.currentSpent}`);
    assert(budgetRes1.body.remainingBalance === 12000, 'Remaining balance is ₹12,000', `Got ${budgetRes1.body.remainingBalance}`);

    // Update budget to ₹18,000
    const updateBudgetRes = await request('/api/budget', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: {
        customerId: userA.customer_id,
        monthlyBudget: 18000
      }
    });
    assert(updateBudgetRes.status === 200, 'POST /api/budget update succeeds', JSON.stringify(updateBudgetRes.body));

    const budgetRes2 = await request(`/api/budget/${userA.customer_id}`);
    assert(budgetRes2.body.monthlyBudget === 18000, 'Updated budget immediately shows ₹18,000', `Got ${budgetRes2.body.monthlyBudget}`);
    assert(budgetRes2.body.remainingBalance === 18000, 'Remaining balance updated to ₹18,000');

    // ---------------------------------------------------------
    // TEST C: Expense Management (Add, Edit, Delete)
    // ---------------------------------------------------------
    console.log(`\n--- TEST C: Expense Management (Add, Edit, Delete) ---`);
    const addExpRes = await request('/api/expenses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: {
        customerId: userA.customer_id,
        title: 'Weekly Organic Vegetables',
        amount: 850,
        category: 'Fruits & Vegetables',
        notes: 'Farmers market purchase'
      }
    });
    assert(addExpRes.status === 201, 'POST /api/expenses returns 201 Created');
    const exp1 = addExpRes.body.expense;
    assert(exp1 && exp1.expense_id, 'Created expense has unique ID', exp1?.expense_id);

    // Verify budget updated with expense deduction
    const budgetAfterExp = await request(`/api/budget/${userA.customer_id}`);
    assert(budgetAfterExp.body.expensesSpent === 850, 'Expenses spent is ₹850', `Got ${budgetAfterExp.body.expensesSpent}`);
    assert(budgetAfterExp.body.currentSpent === 850, 'Total spent is ₹850', `Got ${budgetAfterExp.body.currentSpent}`);
    assert(budgetAfterExp.body.remainingBalance === 17150, 'Remaining balance is ₹17,150 (18000 - 850)', `Got ${budgetAfterExp.body.remainingBalance}`);
    assert(budgetAfterExp.body.categoryBreakdown.length > 0, 'Category breakdown includes Fruits & Vegetables');
    assert(budgetAfterExp.body.expenses.length === 1, 'Expenses list in budget planner contains 1 entry');

    // Edit expense: Change amount to ₹1,200
    const editExpRes = await request(`/api/expenses/${exp1.expense_id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: {
        title: 'Weekly Organic Vegetables & Spices',
        amount: 1200,
        category: 'Fruits & Vegetables'
      }
    });
    assert(editExpRes.status === 200, 'PUT /api/expenses returns 200 OK');

    const budgetAfterEdit = await request(`/api/budget/${userA.customer_id}`);
    assert(budgetAfterEdit.body.expensesSpent === 1200, 'Updated expenses spent is ₹1,200', `Got ${budgetAfterEdit.body.expensesSpent}`);
    assert(budgetAfterEdit.body.remainingBalance === 16800, 'Remaining balance updated to ₹16,800 (18000 - 1200)');

    // Delete expense
    const delExpRes = await request(`/api/expenses/${exp1.expense_id}`, {
      method: 'DELETE'
    });
    assert(delExpRes.status === 200, 'DELETE /api/expenses returns 200 OK');

    const budgetAfterDel = await request(`/api/budget/${userA.customer_id}`);
    assert(budgetAfterDel.body.expensesSpent === 0, 'Expenses spent reset to ₹0 after deletion');
    assert(budgetAfterDel.body.remainingBalance === 18000, 'Remaining balance restored to ₹18,000');
    assert(budgetAfterDel.body.expenses.length === 0, 'Expenses list is empty (clean empty state)');

    // ---------------------------------------------------------
    // TEST D: Store Order Deduction & DWM Constellation Sync
    // ---------------------------------------------------------
    console.log(`\n--- TEST D: Store Purchase Deduction & Warehouse Sync ---`);
    // Re-add a smaller expense: ₹500
    await request('/api/expenses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: {
        customerId: userA.customer_id,
        title: 'Local Milk & Dairy',
        amount: 500,
        category: 'Dairy & Bakery'
      }
    });

    // Place a real store order using valid store and product IDs
    const storesRes = await request('/api/stores');
    const productsRes = await request('/api/products');
    const validStore = storesRes.body[0];
    const p1 = productsRes.body[0];
    const p2 = productsRes.body[1];

    const expectedOrderTotal = (2 * p1.unit_price) + (1 * p2.unit_price);

    const orderRes = await request('/api/orders/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: {
        customerId: userA.customer_id,
        storeId: validStore.store_id,
        items: [
          { productId: p1.product_id, quantity: 2, unitPrice: p1.unit_price },
          { productId: p2.product_id, quantity: 1, unitPrice: p2.unit_price }
        ],
        paymentMethod: 'UPI'
      }
    });
    assert(orderRes.status === 200, `Checkout succeeds (Order total: ₹${expectedOrderTotal.toFixed(2)})`);
    assert(Math.abs(orderRes.body.totalAmount - expectedOrderTotal) < 0.01, 'Order total matches item calculations');

    // Consolidated check: orders (expectedOrderTotal) + manual expenses (₹500)
    const expectedTotalSpent = expectedOrderTotal + 500;
    const expectedRemaining = 18000 - expectedTotalSpent;
    const expectedPercentage = parseFloat(((expectedTotalSpent / 18000) * 100).toFixed(1));

    const budgetConsolidated = await request(`/api/budget/${userA.customer_id}`);
    assert(Math.abs(budgetConsolidated.body.ordersSpent - expectedOrderTotal) < 0.01, `Store orders spent is ₹${expectedOrderTotal.toFixed(2)}`, `Got ${budgetConsolidated.body.ordersSpent}`);
    assert(budgetConsolidated.body.expensesSpent === 500, 'Manual expenses spent is ₹500', `Got ${budgetConsolidated.body.expensesSpent}`);
    assert(Math.abs(budgetConsolidated.body.currentSpent - expectedTotalSpent) < 0.01, `Total spent is ₹${expectedTotalSpent.toFixed(2)} (Orders + Expenses)`, `Got ${budgetConsolidated.body.currentSpent}`);
    assert(Math.abs(budgetConsolidated.body.remainingBalance - expectedRemaining) < 0.01, `Remaining balance is ₹${expectedRemaining.toFixed(2)}`, `Got ${budgetConsolidated.body.remainingBalance}`);
    assert(Math.abs(budgetConsolidated.body.percentageUsed - expectedPercentage) < 0.2, `Percentage used matches ${expectedPercentage}%`, `Got ${budgetConsolidated.body.percentageUsed}`);

    // Fact table check
    assert(budgetConsolidated.body.performanceHistory.length > 0, 'Fact_Budget_Performance table has record');
    const factRow = budgetConsolidated.body.performanceHistory[0];
    assert(Math.abs(factRow.actual_spent - expectedTotalSpent) < 0.01, `Warehouse Fact table actual_spent is ₹${expectedTotalSpent.toFixed(2)}`, `Got ${factRow.actual_spent}`);
    assert(factRow.status === 'UNDER_BUDGET', 'Warehouse Status is UNDER_BUDGET', `Got ${factRow.status}`);

    // ---------------------------------------------------------
    // TEST E: User Isolation (Second User is Independent)
    // ---------------------------------------------------------
    console.log(`\n--- TEST E: User Isolation & Multi-User Independence ---`);
    const regUserB = await request('/api/customers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: {
        customerName: 'Dev Test Patel',
        city: 'Ahmedabad',
        email: 'dev.test@example.com',
        monthlyBudget: 7500
      }
    });
    assert(regUserB.status === 201, 'User B created');
    const userB = regUserB.body;

    // Verify User B now appears FIRST in recent users list (newest registration)
    const listRes2 = await request('/api/customers');
    assert(listRes2.body[0].customer_id === userB.customer_id, 'User B is now FIRST in recent users list', `Got ${listRes2.body[0].customer_id}`);
    assert(listRes2.body[1].customer_id === userA.customer_id, 'User A is now SECOND in recent users list', `Got ${listRes2.body[1].customer_id}`);

    // Verify User B budget & expenses are completely isolated from User A
    const budgetB = await request(`/api/budget/${userB.customer_id}`);
    assert(budgetB.body.monthlyBudget === 7500, 'User B budget is ₹7,500 (independent of User A)');
    assert(budgetB.body.currentSpent === 0, 'User B spent is ₹0 (not affected by User A ₹2,000 spent)');
    assert(budgetB.body.expenses.length === 0, 'User B has 0 expenses (no leak from User A)');

    // ---------------------------------------------------------
    // TEST F: Admin Authentication & Security
    // ---------------------------------------------------------
    console.log(`\n--- TEST F: Admin Password Authentication & Protection ---`);
    // 1. Without password
    const noPassRes = await request('/api/auth/admin-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: {}
    });
    assert(noPassRes.status === 401, 'Admin login without password denied (401)', `Got ${noPassRes.status}`);

    // 2. Incorrect password
    const wrongPassRes = await request('/api/auth/admin-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: { password: 'wrong_password_123' }
    });
    assert(wrongPassRes.status === 401, 'Admin login with wrong password denied (401)', `Got ${wrongPassRes.status}`);

    // 3. Correct password 'shamita'
    const correctPassRes = await request('/api/auth/admin-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: { password: 'shamita' }
    });
    assert(correctPassRes.status === 200, 'Admin login with correct password "shamita" succeeds (200)', `Got ${correctPassRes.status}`);
    const adminToken = correctPassRes.body.token;
    assert(adminToken && adminToken.includes('.'), 'Admin token received with signed signature', adminToken);

    // 4. Verify admin token endpoint
    const verifyRes = await request('/api/auth/verify-admin', {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(verifyRes.status === 200 && verifyRes.body.authenticated === true, 'Admin token verification returns authenticated: true');

    // 5. Test protected ETL endpoint without token
    const unauthEtl = await request('/api/etl/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: { incremental: true }
    });
    assert(unauthEtl.status === 401, 'Protected ETL endpoint denies unauthorized access (401)', `Got ${unauthEtl.status}`);

    // 6. Test protected ETL endpoint with valid token
    const authEtl = await request('/api/etl/run', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: { incremental: true }
    });
    assert(authEtl.status === 200 && authEtl.body.success === true, 'Protected ETL endpoint succeeds with valid admin token', JSON.stringify(authEtl.body));

    console.log(`\n======================================================`);
    console.log(`TEST RESULTS: ${passedTests}/${totalTests} TESTS PASSED`);
    console.log(`======================================================\n`);

    if (passedTests === totalTests) {
      console.log(`🎉 ALL TESTS PASSED SUCCESSFULLY!`);
    } else {
      console.error(`⚠️ SOME TESTS FAILED! Check output above.`);
    }

  } catch (err) {
    console.error('Fatal test error:', err);
  } finally {
    server.close();
    process.exit(passedTests === totalTests ? 0 : 1);
  }
});
