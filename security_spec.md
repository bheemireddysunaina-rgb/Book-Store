# Security Specification & Test Cases (TDD)

## 1. Data Invariants
- **Books Catalog Security**: Books can only be created, updated, or deleted by authorized Administrators. Standard users and guests can only read (`get`, `list`) books.
- **Reviews Integrity**: Reviews can be read by anyone. Reviews can only be created by signed-in, email-verified users where the reviewer's ID (`userId`) exactly matches the active user (`request.auth.uid`). Once written, reviews are immutable.
- **Order Security**: Orders can only be read (`get`, `list`) by the user who owns them (`resource.data.userId == request.auth.uid`) or by Administrators. Standard users can create orders for themselves (where `userId == request.auth.uid`), but they cannot modify them except to transition status to "cancelled" (if current status is "pending").
- **Timestamp Integrity**: All timestamps (`createdAt`, `updatedAt`) must match `request.time`.
- **Input Boundaries**: Every string must have size limits (e.g., Book title <= 150, description <= 2000, comment <= 1000). Every number must match boundaries (e.g., rating >= 1 && rating <= 5, price >= 0, stock >= 0).

---

## 2. The "Dirty Dozen" Malicious Payloads
The following payloads must be strictly blocked and return `PERMISSION_DENIED` in Firestore security rules:

### Payload 1: Unauthorized Book Creation (Guest User)
- **Path**: `/books/malicious_book_1`
- **Operation**: `create`
- **Auth**: None (Unauthenticated)
- **Content**:
  ```json
  {
    "title": "Hacker's Guide to the Galaxy",
    "author": "Anonymous",
    "description": "Exploit book",
    "genre": "Tech",
    "price": 9.99,
    "coverUrl": "https://example.com/cover.jpg",
    "rating": 5,
    "stock": 100,
    "createdAt": "2026-07-14T15:19:00Z",
    "updatedAt": "2026-07-14T15:19:00Z"
  }
  ```

### Payload 2: Unauthorized Book Creation (Standard Logged-in, non-Admin User)
- **Path**: `/books/malicious_book_2`
- **Operation**: `create`
- **Auth**: Signed in user, standard member (`uid: "user_123"`)
- **Content**: *(Same as above)*

### Payload 3: Book with Negative Price (Admin Attempt)
- **Path**: `/books/malicious_book_3`
- **Operation**: `create`
- **Auth**: Admin user (`uid: "admin_user_456"`)
- **Content**:
  ```json
  {
    "title": "Negative Price Book",
    "author": "Skeptic",
    "description": "Very cheap!",
    "genre": "Fiction",
    "price": -19.99,
    "coverUrl": "https://example.com/cover.jpg",
    "rating": 4,
    "stock": 10,
    "createdAt": "request.time",
    "updatedAt": "request.time"
  }
  ```

### Payload 4: Book Immutability Violation (Modifying createdAt as Admin)
- **Path**: `/books/existing_book_abc`
- **Operation**: `update`
- **Auth**: Admin user (`uid: "admin_user_456"`)
- **Content**: Modifying the `createdAt` timestamp from its original value.

### Payload 5: Spoofed Review Creator ID
- **Path**: `/books/existing_book_abc/reviews/spoofed_review_1`
- **Operation**: `create`
- **Auth**: Signed in user (`uid: "user_123"`)
- **Content**:
  ```json
  {
    "userId": "user_victim_999",
    "userName": "Victim",
    "rating": 5,
    "comment": "Spoofed review",
    "createdAt": "request.time"
  }
  ```

### Payload 6: Out-of-bounds Review Rating
- **Path**: `/books/existing_book_abc/reviews/rating_fail`
- **Operation**: `create`
- **Auth**: Signed in user (`uid: "user_123"`)
- **Content**:
  ```json
  {
    "userId": "user_123",
    "userName": "John Doe",
    "rating": 10,
    "comment": "Perfect score!",
    "createdAt": "request.time"
  }
  ```

### Payload 7: Review Comment Exceeding Size Boundary
- **Path**: `/books/existing_book_abc/reviews/comment_too_long`
- **Operation**: `create`
- **Auth**: Signed in user (`uid: "user_123"`)
- **Content**:
  ```json
  {
    "userId": "user_123",
    "userName": "John Doe",
    "rating": 4,
    "comment": "A".repeat(1005),
    "createdAt": "request.time"
  }
  ```

### Payload 8: Spoofed Order Creator ID
- **Path**: `/orders/order_hijack`
- **Operation**: `create`
- **Auth**: Signed in user (`uid: "user_123"`)
- **Content**:
  ```json
  {
    "userId": "another_user_uid",
    "customerName": "Attacker",
    "shippingAddress": "123 Main St",
    "items": [],
    "totalAmount": 100,
    "status": "pending",
    "createdAt": "request.time",
    "updatedAt": "request.time"
  }
  ```

### Payload 9: Unauthorized Order Status Advancement (User attempting Delivery)
- **Path**: `/orders/order_123`
- **Operation**: `update`
- **Auth**: Signed in standard user (`uid: "user_123"`, owner of order_123)
- **Content**: Modifying order status from "pending" or "shipped" directly to "delivered" bypasses courier operations.

### Payload 10: Modifying Immutable Order Fields (UserId change)
- **Path**: `/orders/order_123`
- **Operation**: `update`
- **Auth**: Signed in standard user (`uid: "user_123"`)
- **Content**: Updating `userId` to transfer order ownership.

### Payload 11: Document Poison ID
- **Path**: `/books/some_extremely_long_id_exceeding_128_characters_that_acts_as_a_denial_of_wallet_attack_or_contains_malicious_characters_!@#$`
- **Operation**: `create`
- **Auth**: Signed in user (`uid: "user_123"`)
- **Content**: Standard book payload.

### Payload 12: Order Status Modification on Terminal State (Admins Locked Out)
- **Path**: `/orders/order_completed_xyz`
- **Operation**: `update`
- **Auth**: Signed in standard user (`uid: "user_123"`)
- **Content**: Attempting to cancel an order that is already in "delivered" state.

---

## 3. Conceptual Firestore Test Suite
*(Implemented in the security suite structure)*
All test queries on `/orders` must enforce constraints such that unauthorized users can never fetch order documents that do not belong to them.
