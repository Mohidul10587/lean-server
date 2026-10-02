# উইথড্র সিস্টেমের বাগ রিপোর্ট

---

## বাগ ১ — ডাবল ব্যালেন্স কাটা ✅ Fixed

### সমস্যা

`createWithdrawRequest` এ রিকোয়েস্ট তৈরির সময় ব্যালেন্স কাটা হয়, এরপর `updateStatus` এ Approved হলে **আবার** কাটা হচ্ছিল।

```ts
// updateStatus এ (আগে — ভুল):
wallet.earnedBalance -= withdrawRequest.amount;
await wallet.save({ session });
```

**ফলাফল:** একটি উইথড্রের জন্য ব্যালেন্স দুইবার কাটা যাচ্ছিল।

### সমাধান

`updateStatus` এর Approved ব্লক থেকে ওয়ালেট ডিডাকশন সরিয়ে দেওয়া হয়েছে। শুধু `recentAmount: 0` দিয়ে একটি ট্রানজেকশন লগ তৈরি হয়।

```ts
// updateStatus এ (এখন — সঠিক):
// Balance was already deducted at request creation — no deduction here
await Transaction.create([{ ..., recentAmount: 0, description: "Withdrawal Approved" }], { session });
```

---

## বাগ ২ — updateStatus রুটে Authentication নেই ✅ Fixed

### সমস্যা

`routes.ts` এ `updateStatus` রুটে কোনো middleware ছিল না:

```ts
// আগে — ভুল:
router.put("/updateStatus/:withdrawId", updateStatus);
```

### সমাধান

`verifyAdmin` middleware যোগ করা হয়েছে:

```ts
// এখন — সঠিক:
router.put("/updateStatus/:withdrawId", verifyAdmin, updateStatus);
```

---

## বাগ ৩ — "Pending" স্ট্যাটাসে আপডেট করা যায় ✅ Fixed

### সমস্যা

স্ট্যাটাস ভ্যালিডেশনে `"Pending"` অন্তর্ভুক্ত ছিল:

```ts
// আগে — ভুল:
if (!["Pending", "Rejected", "Approved"].includes(status)) {
```

### সমাধান

ভ্যালিডেশন থেকে `"Pending"` সরিয়ে দেওয়া হয়েছে:

```ts
// এখন — সঠিক:
if (!["Rejected", "Approved"].includes(status)) {
```

---

## সারসংক্ষেপ

| # | বাগ | গুরুত্ব | ফাইল | স্ট্যাটাস |
|---|-----|---------|------|-----------|
| ১ | Approved হলে ডাবল ব্যালেন্স কাটা | 🔴 Critical | `withdraw.controller.ts` | ✅ Fixed |
| ২ | updateStatus রুটে Authentication নেই | 🔴 Critical | `routes.ts` | ✅ Fixed |
| ৩ | Pending স্ট্যাটাসে আপডেট করা যায় | 🟡 Minor | `withdraw.controller.ts` | ✅ Fixed |
