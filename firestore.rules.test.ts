import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, collection, getDocs } from 'firebase/firestore';
import * as fs from 'fs';

let testEnv: RulesTestEnvironment;

export async function runDirtyDozenSecurityTests() {
  testEnv = await initializeTestEnvironment({
    projectId: 'gen-lang-client-0831424862',
    firestore: {
      rules: fs.readFileSync('firestore.rules', 'utf8'),
    },
  });

  const userA = testEnv.authenticatedContext('user_a', {
    email: 'customer@hospital.gh',
    email_verified: true,
  });
  const unverifiedAdmin = testEnv.authenticatedContext('fake_admin', {
    email: 'waamikan@gmail.com',
    email_verified: false,
  });
  const guest = testEnv.unauthenticatedContext();

  // 1. Self-Admin Registration Spoof
  await assertFails(
    setDoc(doc(userA.firestore(), 'users/user_a'), {
      uid: 'user_a',
      email: 'customer@hospital.gh',
      role: 'super_admin',
      createdAt: new Date().toISOString(),
    })
  );

  // 2. Unverified Email Admin Spoof
  await assertFails(
    setDoc(doc(unverifiedAdmin.firestore(), 'users/fake_admin'), {
      uid: 'fake_admin',
      email: 'waamikan@gmail.com',
      role: 'super_admin',
      createdAt: new Date().toISOString(),
    })
  );

  // 3. Privilege Escalation & Ghost Field Update
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'users/user_a'), {
      uid: 'user_a',
      email: 'customer@hospital.gh',
      role: 'user',
      createdAt: new Date().toISOString(),
    });
    await setDoc(doc(ctx.firestore(), 'users/user_b'), {
      uid: 'user_b',
      email: 'other@hospital.gh',
      role: 'user',
      createdAt: new Date().toISOString(),
    });
  });

  await assertFails(
    updateDoc(doc(userA.firestore(), 'users/user_a'), {
      role: 'admin',
      isRoot: true,
    })
  );

  // 4. Cross-User Profile Read & Users List Scrape
  await assertFails(getDoc(doc(userA.firestore(), 'users/user_b')));
  await assertFails(getDocs(collection(userA.firestore(), 'users')));

  // 5. Unauthenticated / Customer Invoice Forgery
  await assertFails(
    setDoc(doc(userA.firestore(), 'invoices/inv_forged'), {
      invoiceNumber: 'FAKE-0001',
      customerId: 'cust_1',
      items: [],
      total: 0,
      status: 'paid',
    })
  );

  // 6. Web Order State Shortcutting
  await assertFails(
    setDoc(doc(userA.firestore(), 'web_orders/order_shortcut'), {
      orderNumber: 'ORD-0001',
      userId: 'user_a',
      customerName: 'Clinic A',
      contactName: 'Dr A',
      email: 'customer@hospital.gh',
      phone: '0500000000',
      address: 'Accra',
      items: [{ productId: 'p1', name: 'Mask', quantity: 1, unitPrice: 10, total: 10 }],
      subtotal: 10,
      vat: 0.5,
      total: 10.5,
      status: 'invoiced',
      createdAt: new Date().toISOString(),
    })
  );

  // 7. Web Order Cross-User Impersonation
  await assertFails(
    setDoc(doc(userA.firestore(), 'web_orders/order_impersonate'), {
      orderNumber: 'ORD-0002',
      userId: 'user_b',
      customerName: 'Clinic A',
      contactName: 'Dr A',
      email: 'customer@hospital.gh',
      phone: '0500000000',
      address: 'Accra',
      items: [{ productId: 'p1', name: 'Mask', quantity: 1, unitPrice: 10, total: 10 }],
      subtotal: 10,
      vat: 0.5,
      total: 10.5,
      status: 'pending',
      createdAt: new Date().toISOString(),
    })
  );

  // 8. Product Price Tampering
  await assertFails(
    updateDoc(doc(userA.firestore(), 'products/prod_1'), {
      price: 0.01,
    })
  );

  // 9. Journal Entry Tampering
  await assertFails(
    setDoc(doc(userA.firestore(), 'journal_entries/je_1'), {
      date: new Date().toISOString(),
      reference: 'tamper',
      description: 'tamper',
      lines: [{ accountId: '1', debit: 100, credit: 0 }],
      status: 'posted',
    })
  );

  // 10. ID Poisoning Attack (> 128 chars)
  const longId = 'a'.repeat(200);
  await assertFails(
    setDoc(doc(guest.firestore(), `requests/${longId}`), {
      name: 'Spammer',
      email: 'spam@test.com',
      message: 'hello',
      status: 'new',
      createdAt: new Date().toISOString(),
    })
  );

  // 11. Oversized Request / Ghost Field Injection
  await assertFails(
    setDoc(doc(guest.firestore(), 'requests/req_oversized'), {
      name: 'Attacker',
      email: 'attack@test.com',
      message: 'x'.repeat(10000),
      status: 'new',
      adminNote: 'ghost_field',
      createdAt: new Date().toISOString(),
    })
  );

  // 12. Blanket CRM / Customer / Employee Scrape
  await assertFails(getDocs(collection(userA.firestore(), 'customers')));
  await assertFails(getDocs(collection(userA.firestore(), 'employees')));

  // Positive sanity check: Valid guest request succeeds
  await assertSucceeds(
    setDoc(doc(guest.firestore(), 'requests/req_valid_1'), {
      name: 'Korle Bu Procurement',
      email: 'procure@kbth.gov.gh',
      hospital: 'Korle Bu Teaching Hospital',
      message: 'Requesting quote for surgical consumables.',
      status: 'new',
      createdAt: new Date().toISOString(),
    })
  );

  await testEnv.cleanup();
}
